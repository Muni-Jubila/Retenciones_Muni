import { NextResponse } from 'next/server'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { isEmbargosMock } from '@/lib/mock-mode'
import { logServerError } from '@/lib/safe-error'
import {
  analizarPlanillaRetencionesArchivo,
  resumenPlanillaVacio,
} from '@/lib/planilla-preview'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recibe la planilla de liquidación como body binario y devuelve la vista
 * previa de las retenciones. Se usa un route handler (y no una Server Action)
 * porque ExcelJS necesita un stream de Node para leer archivos grandes.
 */
export async function POST(request: Request) {
  if (isEmbargosMock()) {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'La importación desde Excel no está disponible en modo demo.' },
      { status: 400 },
    )
  }

  try {
    await requireAuthenticatedSession()
  } catch {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'Sesión inválida o vencida. Ingresá nuevamente.' },
      { status: 401 },
    )
  }

  const nombre = decodeURIComponent(request.headers.get('x-archivo-nombre') ?? '')
  if (!/\.(xlsx|xlsm)$/i.test(nombre)) {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'El archivo debe ser una planilla .xlsx o .xlsm.' },
      { status: 400 },
    )
  }
  if (!request.body) {
    return NextResponse.json(
      { ...resumenPlanillaVacio(), error: 'No se recibió el archivo de la planilla.' },
      { status: 400 },
    )
  }

  try {
    const resultado = await analizarPlanillaRetencionesArchivo(
      request.body as ReadableStream<Uint8Array>,
    )
    return NextResponse.json(resultado)
  } catch (error) {
    logServerError('[planilla/preview] Error:', error)
    return NextResponse.json(
      {
        ...resumenPlanillaVacio(),
        error: error instanceof Error ? error.message : 'No se pudo procesar la planilla.',
      },
      { status: 400 },
    )
  }
}
