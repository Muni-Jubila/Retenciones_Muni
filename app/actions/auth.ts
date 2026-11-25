'use server'

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import { headers } from 'next/headers'
import {
  clearSessionCookie,
  closeExpiredSessions,
  closeSessionsForUser,
  getAuthenticatedSession,
  setSessionCookie,
} from '@/lib/auth-session'
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from '@/lib/login-rate-limit'
import { logServerError } from '@/lib/safe-error'

/**
 * Hash de descarte para que un usuario inexistente tarde lo mismo que uno
 * existente al validar la contraseña y no se pueda enumerar por timing.
 */
const DUMMY_PASSWORD_HASH = '$2b$12$2NcrKu/z4uYKpnopg.NAiu/zxUJSmvQS9RNHQRL70n4rEAV4mMSWu'

export interface LoginResult {
  ok: boolean
  username?: string
  userId?: number
  role?: string
  mustChangePassword?: boolean
  error?: string
}

export async function loginUsuario(
  nombreUsuario: string,
  contrasena: string,
): Promise<LoginResult> {
  const username = nombreUsuario.trim()

  try {
    // La IP se toma de los headers que agrega Vercel. En desarrollo no existe y
    // se usa un valor local; la clave del limiter se guarda hasheada en la base.
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')
    const clientAddress =
      forwardedFor?.split(',')[0]?.trim() || headerStore.get('x-real-ip') || 'local'

    if (!process.env.DATABASE_URL) {
      console.error('[loginUsuario] DATABASE_URL no está configurada en las variables de entorno.')
      return { ok: false, error: 'El servicio no está disponible temporalmente.' }
    }

    if (!username || !contrasena) {
      return { ok: false, error: 'Usuario y contraseña son obligatorios.' }
    }
    if (username.length > 100 || contrasena.length > 255) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }
    if (await isLoginBlocked(username, clientAddress)) {
      return { ok: false, error: 'Demasiados intentos fallidos. Esperá unos minutos e intentá nuevamente.' }
    }

    const usuario = await prisma.uSUARIO.findUnique({
      where: { NOMBRE_USUARIO: username },
      include: { ROL_RETENCIONES: true },
    })

    if (!usuario) {
      await bcrypt.compare(contrasena, DUMMY_PASSWORD_HASH)
      await recordLoginFailure(username, clientAddress)
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    const tieneHashBcrypt = /^\$2[aby]\$\d{2}\$/.test(usuario.CONTRASENA_USUARIO)
    if (!tieneHashBcrypt) {
      // Las contraseñas sin hash no se aceptan. El administrador debe resetearla
      // desde Gestión de Usuarios para que se guarde con bcrypt.
      await bcrypt.compare(contrasena, DUMMY_PASSWORD_HASH)
      logServerError(
        '[loginUsuario] Usuario con contraseña sin hash:',
        new Error(`ID_USUARIO=${usuario.ID_USUARIO}`),
      )
      await recordLoginFailure(username, clientAddress)
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }
    const passwordOk = await bcrypt.compare(contrasena, usuario.CONTRASENA_USUARIO)

    if (!passwordOk) {
      await recordLoginFailure(username, clientAddress)
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    if (!usuario.ID_ROL_RETENCIONES || !usuario.ROL_RETENCIONES) {
      return { ok: false, error: 'Tu usuario no tiene un rol asignado en Retenciones. Contactá al administrador.' }
    }

    await clearLoginFailures(username, clientAddress)
    try {
      await closeExpiredSessions()
    } catch (error) {
      logServerError('[loginUsuario] No se pudieron cerrar sesiones vencidas:', error)
    }

    // Registrar inicio de sesión
    const sesion = await prisma.sESION.create({
      data: {
        ID_USUARIO: usuario.ID_USUARIO,
        FECHA_HORA_INICIO: new Date(),
      },
    })
    await setSessionCookie(sesion.ID_SESION)

    return {
      ok: true,
      username: usuario.NOMBRE_USUARIO,
      userId: usuario.ID_USUARIO,
      role: usuario.ROL_RETENCIONES?.NOMBRE_ROL ?? '',
      mustChangePassword: usuario.DEBE_CAMBIAR_CONTRASENA,
    }
  } catch (error) {
    const errorId = randomUUID()
    logServerError(`[loginUsuario] errorId=${errorId}`, error)
    return { ok: false, error: `Error interno. Contacte al administrador con el código ${errorId}.` }
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getAuthenticatedSession()
    if (!session) return { ok: false, error: 'Sesión inválida o vencida.' }
    if (newPassword.length < 5 || newPassword.length > 25) {
      return { ok: false, error: 'La nueva contraseña debe tener entre 5 y 25 caracteres.' }
    }
    if (currentPassword === newPassword) {
      return { ok: false, error: 'La nueva contraseña debe ser diferente.' }
    }
    const usuario = await prisma.uSUARIO.findUnique({ where: { ID_USUARIO: session.userId } })
    if (!usuario || !(await bcrypt.compare(currentPassword, usuario.CONTRASENA_USUARIO))) {
      return { ok: false, error: 'La contraseña actual es incorrecta.' }
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.uSUARIO.update({
      where: { ID_USUARIO: session.userId },
      data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: false },
    })
    await closeSessionsForUser(session.userId, session.sessionId)
    return { ok: true }
  } catch (error) {
    const errorId = randomUUID()
    logServerError(`[changePassword] errorId=${errorId}`, error)
    return { ok: false, error: `No se pudo cambiar la contraseña. Código: ${errorId}.` }
  }
}

/**
 * Registra el cierre de sesión actualizando FECHA_HORA_FIN en la última sesión activa.
 */
export async function logoutUsuario(): Promise<void> {
  try {
    const sesionActiva = await getAuthenticatedSession()
    if (sesionActiva) {
      await prisma.sESION.update({
        where: { ID_SESION: sesionActiva.sessionId },
        data: { FECHA_HORA_FIN: new Date() },
      })
    }
  } catch (error) {
    logServerError('[logoutUsuario] Error:', error)
  } finally {
    await clearSessionCookie()
  }
}

export async function getCurrentSession(touchActivity = true): Promise<LoginResult> {
  try {
    const session = await getAuthenticatedSession(touchActivity)
    if (!session) {
      await clearSessionCookie()
      return { ok: false }
    }
    return {
      ok: true,
      username: session.username,
      userId: session.userId,
      role: session.role,
      mustChangePassword: session.mustChangePassword,
    }
  } catch (error) {
    logServerError('[getCurrentSession] Error:', error)
    return { ok: false }
  }
}
