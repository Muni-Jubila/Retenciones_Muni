import { moneyToInput, type EmbargoInput } from '@/lib/embargos'
import type { DatosOficio } from '@/lib/oficio-parser'

/** Convierte los datos detectados en el PDF a valores del formulario de embargo. */
export function oficioToPrefill(datos: DatosOficio): Partial<EmbargoInput> {
  const prefill: Partial<EmbargoInput> = {}
  if (datos.autos) prefill.autos = datos.autos
  if (datos.expediente) prefill.expediente = datos.expediente
  if (datos.fechaExpediente) prefill.fechaExpediente = datos.fechaExpediente
  if (datos.cuenta) {
    // La Cuenta N° se guarda sólo con dígitos y hasta 8 posiciones.
    const cuenta = datos.cuenta.replace(/\D/g, '')
    if (cuenta && cuenta.length <= 8) prefill.cuenta = cuenta
  }
  if (datos.sucursal) prefill.sucursal = datos.sucursal
  if (datos.juez) prefill.juez = datos.juez
  // El campo “Juez” del formulario guarda el nombre del juez detectado en el
  // cierre del oficio. Si no aparece, queda vacío para completarlo manualmente.
  prefill.secretaria = datos.juezNombre
  if (datos.monto > 0) prefill.deuda = moneyToInput(datos.monto)
  if (datos.numeroOficio) prefill.observaciones = `Oficio judicial N° ${datos.numeroOficio}.`
  return prefill
}

/**
 * Genera el alta completa de un embargo a partir del oficio y el agente
 * detectado. Los campos que no vienen en el PDF quedan vacíos para que el
 * servidor aplique los valores automáticos (estado, expediente de retenciones).
 */
export function oficioToEmbargoInput(datos: DatosOficio, idAgente: number): EmbargoInput {
  return {
    idAgente,
    estado: '',
    autos: '',
    expediente: '',
    expedienteRetenciones: '',
    fechaExpediente: '',
    cuenta: '',
    sucursal: '',
    juez: '',
    instancia: '',
    nomenclatura: '',
    tipoProceso: '',
    secretaria: '',
    deuda: '',
    importeMensual: '',
    porcentaje: '',
    marcaEspecial: '',
    observaciones: '',
    ...oficioToPrefill(datos),
  }
}
