import 'server-only'

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

const MAX_FAILURES = 5
const MAX_BLOCK_MINUTES = 60
const CLEANUP_AFTER_HOURS = 24

interface AttemptRow {
  FALLOS: number
  BLOQUEADO_HASTA: Date | null
}

function keyFor(username: string, clientAddress: string): string {
  return createHash('sha256')
    .update(`${clientAddress}\0${username.trim().toLocaleLowerCase('es')}`)
    .digest('hex')
}

/** Backoff progresivo: 5 fallos → 1 min, 6 → 2, 7 → 4, 8 → 8, 9 → 16, 10 → 32, 11+ → 60. */
function blockMinutes(failures: number): number {
  if (failures < MAX_FAILURES) return 0
  return Math.min(MAX_BLOCK_MINUTES, 2 ** (failures - MAX_FAILURES))
}

export async function isLoginBlocked(username: string, clientAddress: string): Promise<boolean> {
  const row = await prisma.iNTENTO_LOGIN.findUnique({
    where: { CLAVE: keyFor(username, clientAddress) },
    select: { BLOQUEADO_HASTA: true },
  })
  return Boolean(row?.BLOQUEADO_HASTA && row.BLOQUEADO_HASTA.getTime() > Date.now())
}

export async function recordLoginFailure(username: string, clientAddress: string): Promise<void> {
  const key = keyFor(username, clientAddress)

  const rows = await prisma.$queryRaw<AttemptRow[]>`
    INSERT INTO "RETENCIONES_INTENTO_LOGIN" ("CLAVE", "FALLOS", "PRIMER_FALLO", "ULTIMO_FALLO")
    VALUES (${key}, 1, now(), now())
    ON CONFLICT ("CLAVE") DO UPDATE SET
      "FALLOS" = CASE
        WHEN "RETENCIONES_INTENTO_LOGIN"."ULTIMO_FALLO" < now() - interval '15 minutes' THEN 1
        ELSE "RETENCIONES_INTENTO_LOGIN"."FALLOS" + 1
      END,
      "PRIMER_FALLO" = CASE
        WHEN "RETENCIONES_INTENTO_LOGIN"."ULTIMO_FALLO" < now() - interval '15 minutes' THEN now()
        ELSE "RETENCIONES_INTENTO_LOGIN"."PRIMER_FALLO"
      END,
      "ULTIMO_FALLO" = now()
    RETURNING "FALLOS", "BLOQUEADO_HASTA"
  `

  const failures = Number(rows[0]?.FALLOS ?? 0)
  const minutes = blockMinutes(failures)
  if (minutes > 0) {
    await prisma.iNTENTO_LOGIN.update({
      where: { CLAVE: key },
      data: { BLOQUEADO_HASTA: new Date(Date.now() + minutes * 60_000) },
    })
  }

  console.warn(`[login-rate-limit] intento fallido key=${key.slice(0, 12)} failures=${failures}`)

  // Limpieza oportunista de registros viejos.
  await prisma.iNTENTO_LOGIN.deleteMany({
    where: { ULTIMO_FALLO: { lt: new Date(Date.now() - CLEANUP_AFTER_HOURS * 60 * 60_000) } },
  })
}

export async function clearLoginFailures(username: string, clientAddress: string): Promise<void> {
  await prisma.iNTENTO_LOGIN.deleteMany({ where: { CLAVE: keyFor(username, clientAddress) } })
}
