'use client'

/**
 * Sube un archivo al servidor en fragmentos de 3 MB.
 *
 * Vercel limita el body de cada request a 4,5 MB, así que las planillas de
 * Excel y los oficios PDF grandes se envían por partes y el servidor los
 * reconstruye antes de procesarlos.
 */

const FRAGMENTO_BYTES = 3 * 1024 * 1024

export async function subirArchivoEnPartes(
  file: File,
  onProgress?: (porcentaje: number) => void,
): Promise<string> {
  const inicio = await fetch('/api/embargos/archivos/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: file.name, tipo: file.type, tamano: file.size }),
  })
  const datos = (await inicio.json().catch(() => null)) as
    | { ok?: boolean; id?: string; error?: string }
    | null
  if (!inicio.ok || !datos?.ok || !datos.id) {
    throw new Error(datos?.error ?? 'No se pudo iniciar la carga del archivo.')
  }

  const id = datos.id
  const total = Math.max(1, Math.ceil(file.size / FRAGMENTO_BYTES))
  for (let indice = 0; indice < total; indice += 1) {
    const fragmento = file.slice(indice * FRAGMENTO_BYTES, (indice + 1) * FRAGMENTO_BYTES)
    const respuesta = await fetch(`/api/embargos/archivos/${id}/fragmento?indice=${indice}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: fragmento,
    })
    const resultado = (await respuesta.json().catch(() => null)) as
      | { ok?: boolean; error?: string }
      | null
    if (!respuesta.ok || !resultado?.ok) {
      throw new Error(resultado?.error ?? 'No se pudo subir el archivo.')
    }
    onProgress?.((indice + 1) / total)
  }

  return id
}
