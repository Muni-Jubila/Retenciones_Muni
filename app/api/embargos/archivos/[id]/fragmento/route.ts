import { NextResponse } from 'next/server'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { guardarFragmento } from '@/lib/carga-archivos'
import { logServerError } from '@/lib/safe-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Guarda un fragmento binario de una carga. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuthenticatedSession()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Sesión inválida o vencida. Ingresá nuevamente.' },
      { status: 401 },
    )
  }

  const { id } = await params
  const indice = Number(new URL(request.url).searchParams.get('indice') ?? '')

  try {
    if (!request.body) {
      return NextResponse.json({ ok: false, error: 'No se recibió el fragmento.' }, { status: 400 })
    }
    const contenido = Buffer.from(await request.arrayBuffer())
    const resultado = await guardarFragmento(id, indice, contenido)
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 })
  } catch (error) {
    logServerError('[archivos/fragmento] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'No se pudo guardar el fragmento del archivo.' },
      { status: 500 },
    )
  }
}
