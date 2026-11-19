import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'retenciones_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60
const SESSION_IDLE_SECONDS = 6 * 60 * 60
const SESSION_ACTIVITY_UPDATE_MS = 60 * 1000

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function decodeCookie(value: string | undefined): { sessionId: number; lastActivity: number } | null {
  if (!value) return null
  const [sessionId, lastActivity, nonce, signature] = value.split('.')
  if (!/^\d+$/.test(sessionId) || !/^\d+$/.test(lastActivity) || !/^[a-f0-9]{32}$/.test(nonce) || !signature) return null

  const expected = Buffer.from(sign(`${sessionId}.${lastActivity}.${nonce}`))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  const parsed = Number(sessionId)
  const parsedActivity = Number(lastActivity)
  if (!Number.isSafeInteger(parsed) || !Number.isSafeInteger(parsedActivity)) return null
  return { sessionId: parsed, lastActivity: parsedActivity }
}

export async function setSessionCookie(sessionId: number): Promise<void> {
  const nonce = randomBytes(16).toString('hex')
  const payload = `${sessionId}.${Date.now()}.${nonce}`
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_IDLE_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export interface AuthenticatedSession {
  sessionId: number
  userId: number
  username: string
  role: string
  roleId: number | null
  mustChangePassword: boolean
}

interface SessionRow {
  ID_SESION: number
  ID_USUARIO: number
  FECHA_HORA_INICIO: Date
  FECHA_HORA_FIN: Date | null
  ULTIMA_ACTIVIDAD: Date
  NOMBRE_USUARIO: string
  ES_RETENCIONES: boolean
  ID_ROL_RETENCIONES: number | null
  DEBE_CAMBIAR_CONTRASENA: boolean
  NOMBRE_ROL: string | null
}

export async function getAuthenticatedSession(touchActivity = true): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies()
  const decoded = decodeCookie(cookieStore.get(SESSION_COOKIE)?.value)
  if (!decoded) return null

  // Una sola consulta con JOIN: antes Prisma hacía 5 viajes (BEGIN, DEALLOCATE,
  // sesión, usuario y COMMIT) por cada validación de sesión.
  const filas = await prisma.$queryRaw<SessionRow[]>`
    SELECT
      s."ID_SESION",
      s."ID_USUARIO",
      s."FECHA_HORA_INICIO",
      s."FECHA_HORA_FIN",
      s."ULTIMA_ACTIVIDAD",
      u."NOMBRE_USUARIO",
      u."RETENCIONES" AS "ES_RETENCIONES",
      u."ID_ROL_RETENCIONES",
      u."DEBE_CAMBIAR_CONTRASENA",
      r."NOMBRE_ROL"
    FROM "SESION" s
    INNER JOIN "USUARIO" u ON u."ID_USUARIO" = s."ID_USUARIO"
    LEFT JOIN "Rol_Retenciones" r ON r."ID_ROL_RETENCIONES" = u."ID_ROL_RETENCIONES"
    WHERE s."ID_SESION" = ${decoded.sessionId}
    LIMIT 1
  `
  const session = filas[0]
  if (!session || session.FECHA_HORA_FIN) return null

  if (!session.ES_RETENCIONES || !session.ID_ROL_RETENCIONES || !session.NOMBRE_ROL) {
    await prisma.sESION.update({
      where: { ID_SESION: session.ID_SESION },
      data: { FECHA_HORA_FIN: new Date() },
    })
    return null
  }

  const now = Date.now()
  const lastActivity = session.ULTIMA_ACTIVIDAD?.getTime() ?? session.FECHA_HORA_INICIO.getTime()
  const expiresAt = session.FECHA_HORA_INICIO.getTime() + SESSION_DURATION_SECONDS * 1000
  const idleExpired = now - lastActivity >= SESSION_IDLE_SECONDS * 1000
  if (idleExpired || now >= expiresAt) {
    await prisma.sESION.update({
      where: { ID_SESION: session.ID_SESION },
      data: { FECHA_HORA_FIN: new Date() },
    })
    return null
  }

  // La actividad se persiste en la base para que el vencimiento por inactividad
  // no dependa del timestamp de la cookie. Se escribe como máximo una vez por minuto.
  if (touchActivity && now - lastActivity >= SESSION_ACTIVITY_UPDATE_MS) {
    await prisma.sESION.update({
      where: { ID_SESION: session.ID_SESION },
      data: { ULTIMA_ACTIVIDAD: new Date() },
    })
  }

  await setSessionCookie(session.ID_SESION)

  return {
    sessionId: session.ID_SESION,
    userId: session.ID_USUARIO,
    username: session.NOMBRE_USUARIO,
    role: session.NOMBRE_ROL ?? '',
    roleId: session.ID_ROL_RETENCIONES,
    mustChangePassword: session.DEBE_CAMBIAR_CONTRASENA,
  }
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession()
  if (!session) throw new Error('Sesión inválida o vencida. Ingrese nuevamente.')
  if (session.mustChangePassword) {
    throw new Error('Debe cambiar la contraseña antes de continuar.')
  }
  return session
}

/**
 * Cierra las sesiones que ya vencieron por inactividad (6 h) o por duración
 * absoluta (8 h). Se ejecuta al iniciar sesión para mantener la tabla al día.
 */
export async function closeExpiredSessions(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "SESION"
    SET "FECHA_HORA_FIN" = LEAST(
      "ULTIMA_ACTIVIDAD" + interval '6 hours',
      "FECHA_HORA_INICIO" + interval '8 hours'
    )
    WHERE "FECHA_HORA_FIN" IS NULL
      AND LEAST(
        "ULTIMA_ACTIVIDAD" + interval '6 hours',
        "FECHA_HORA_INICIO" + interval '8 hours'
      ) < now()
  `
}

/** Cierra las sesiones activas de un usuario, opcionalmente conservando la actual. */
export async function closeSessionsForUser(userId: number, exceptSessionId?: number): Promise<void> {
  await prisma.sESION.updateMany({
    where: {
      ID_USUARIO: userId,
      FECHA_HORA_FIN: null,
      ...(exceptSessionId ? { ID_SESION: { not: exceptSessionId } } : {}),
    },
    data: { FECHA_HORA_FIN: new Date() },
  })
}
