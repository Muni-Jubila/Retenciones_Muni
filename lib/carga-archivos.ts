import 'server-only'

import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'

/**
 * Carga temporal de archivos en fragmentos.
 *
 * Vercel limita el body de cada request a 4,5 MB. Para permitir planillas de
 * Excel y oficios PDF de cualquier tamaño, el navegador parte el archivo en
 * bloques de 3 MB y los envía por separado. Acá se guardan en la base y se
 * reconstruyen cuando el archivo está completo.
 */

export const FRAGMENTO_BYTES = 3 * 1024 * 1024
export const MAX_ARCHIVO_BYTES = 200 * 1024 * 1024
const VIGENCIA_MS = 2 * 60 * 60 * 1000

interface CargaRow {
  ID: string
  NOMBRE: string
  TIPO: string
  TAMANO: number
  FRAGMENTOS: number
}

interface FragmentoRow {
  CONTENIDO: Buffer
}

export interface CargaArchivo {
  id: string
  nombre: string
  tipo: string
  tamano: number
  buffer: Buffer
}

let tablasListas: Promise<void> | null = null

/** Crea las tablas temporales si no existen (idempotente). */
async function asegurarTablas(): Promise<void> {
  if (!tablasListas) {
    tablasListas = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CARGA_ARCHIVO" (
          "ID" TEXT NOT NULL,
          "NOMBRE" TEXT NOT NULL,
          "TIPO" TEXT NOT NULL,
          "TAMANO" INTEGER NOT NULL,
          "FRAGMENTOS" INTEGER NOT NULL,
          "CREADO" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CARGA_ARCHIVO_PKEY" PRIMARY KEY ("ID")
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "CARGA_ARCHIVO_FRAGMENTO" (
          "ID_CARGA" TEXT NOT NULL,
          "INDICE" INTEGER NOT NULL,
          "CONTENIDO" BYTEA NOT NULL,
          CONSTRAINT "CARGA_ARCHIVO_FRAGMENTO_PKEY" PRIMARY KEY ("ID_CARGA", "INDICE"),
          CONSTRAINT "CARGA_ARCHIVO_FRAGMENTO_ID_CARGA_FKEY" FOREIGN KEY ("ID_CARGA")
            REFERENCES "CARGA_ARCHIVO" ("ID") ON DELETE CASCADE ON UPDATE CASCADE
        )
      `)
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "idx_carga_archivo_creado"
          ON "CARGA_ARCHIVO" ("CREADO")
      `)
    })().catch((error) => {
      tablasListas = null
      throw error
    })
  }
  return tablasListas
}

export async function iniciarCarga(input: {
  nombre: string
  tipo: string
  tamano: number
}): Promise<{ ok: true; id: string; fragmentos: number } | { ok: false; error: string }> {
  await asegurarTablas()
  const nombre = String(input.nombre ?? '').trim().slice(0, 255)
  const tipo = String(input.tipo ?? '').trim().slice(0, 150) || 'application/octet-stream'
  const tamano = Number(input.tamano)

  if (!nombre) return { ok: false, error: 'El archivo no tiene nombre.' }
  if (!Number.isFinite(tamano) || tamano <= 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (tamano > MAX_ARCHIVO_BYTES) {
    return {
      ok: false,
      error: `El archivo supera el tamaño máximo permitido (${Math.round(MAX_ARCHIVO_BYTES / 1024 / 1024)} MB).`,
    }
  }

  await limpiarCargasVencidas()

  const id = randomUUID()
  const fragmentos = Math.ceil(tamano / FRAGMENTO_BYTES)
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CARGA_ARCHIVO" ("ID", "NOMBRE", "TIPO", "TAMANO", "FRAGMENTOS")
     VALUES ($1, $2, $3, $4, $5)`,
    id,
    nombre,
    tipo,
    tamano,
    fragmentos,
  )

  return { ok: true, id, fragmentos }
}

export async function guardarFragmento(
  id: string,
  indice: number,
  contenido: Buffer,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await asegurarTablas()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Carga inválida.' }
  if (!Number.isInteger(indice) || indice < 0) return { ok: false, error: 'Fragmento inválido.' }
  if (!Buffer.isBuffer(contenido) || contenido.length === 0) {
    return { ok: false, error: 'El fragmento está vacío.' }
  }
  if (contenido.length > FRAGMENTO_BYTES) {
    return { ok: false, error: 'El fragmento supera el tamaño permitido.' }
  }

  const [carga] = await prisma.$queryRawUnsafe<CargaRow[]>(
    `SELECT "FRAGMENTOS" FROM "CARGA_ARCHIVO" WHERE "ID" = $1`,
    id,
  )
  if (!carga) return { ok: false, error: 'La carga no existe o venció.' }
  if (indice >= carga.FRAGMENTOS) return { ok: false, error: 'Fragmento fuera de rango.' }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "CARGA_ARCHIVO_FRAGMENTO" ("ID_CARGA", "INDICE", "CONTENIDO")
     VALUES ($1, $2, $3)
     ON CONFLICT ("ID_CARGA", "INDICE")
     DO UPDATE SET "CONTENIDO" = EXCLUDED."CONTENIDO"`,
    id,
    indice,
    contenido,
  )

  return { ok: true }
}

export async function leerCarga(id: string): Promise<CargaArchivo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const [carga] = await prisma.$queryRawUnsafe<CargaRow[]>(
    `SELECT "ID", "NOMBRE", "TIPO", "TAMANO", "FRAGMENTOS"
     FROM "CARGA_ARCHIVO" WHERE "ID" = $1`,
    id,
  )
  if (!carga) return null

  const fragmentos = await prisma.$queryRawUnsafe<FragmentoRow[]>(
    `SELECT "CONTENIDO" FROM "CARGA_ARCHIVO_FRAGMENTO"
     WHERE "ID_CARGA" = $1 ORDER BY "INDICE" ASC`,
    id,
  )
  if (fragmentos.length !== carga.FRAGMENTOS) return null

  const buffer = Buffer.concat(fragmentos.map((fragmento) => Buffer.from(fragmento.CONTENIDO)))
  if (buffer.length !== carga.TAMANO) return null

  return {
    id: carga.ID,
    nombre: carga.NOMBRE,
    tipo: carga.TIPO,
    tamano: carga.TAMANO,
    buffer,
  }
}

export async function eliminarCarga(id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return
  await prisma.$executeRawUnsafe(`DELETE FROM "CARGA_ARCHIVO" WHERE "ID" = $1`, id)
}

async function limpiarCargasVencidas(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "CARGA_ARCHIVO" WHERE "CREADO" < now() - ($1::bigint * interval '1 millisecond')`,
      VIGENCIA_MS,
    )
  } catch {
    // La limpieza es oportunista: no debe impedir una carga nueva.
  }
}
