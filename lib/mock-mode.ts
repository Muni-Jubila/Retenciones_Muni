// Modo de vista previa: permite recorrer el frontend del módulo de Embargos
// sin necesidad de tener las tablas EMBARGO / RETENCION_EMBARGO en la base.
// Se activa con EMBARGOS_MOCK=1 (por ejemplo en .env.local). Por defecto
// está desactivado, por lo que en producción el comportamiento es el real.
export function isEmbargosMock(): boolean {
  return process.env.EMBARGOS_MOCK === '1'
}