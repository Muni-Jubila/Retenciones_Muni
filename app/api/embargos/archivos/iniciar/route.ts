import { NextResponse } from 'next/server'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { iniciarCarga } from '@/lib/carga-archivos'
import { logServerError } from '@/lib/safe-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Autoriza una carga por fragmentos y devuelve el identificador. */
export async function POST(request: Request) {
  try {
    await requireAuthenticatedSession()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Sesión inválida o vencida. Ingresá nuevamente.' },
      { status: 401 },
    )
  }

  try {
    const body = (await request.json()) as { nombre?: string; tipo?: string; tamano?: number }
    const resultado = await iniciarCarga({
      nombre: body?.nombre ?? '',
      tipo: body?.tipo ?? '',
      tamano: Number(body?.tamano ?? 0),
    })
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 })
  } catch (error) {
    logServerError('[archivos/iniciar] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo iniciar la carga del archivo.' },
      { status: 500 },
    )
  }
}
