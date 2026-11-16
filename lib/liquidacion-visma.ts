import ExcelJS from 'exceljs'

/**
 * Archivo de interfaz para VISMA (liquidación de sueldos).
 *
 * Formato equivalente al CSV "interfaz embargos" que usa el circuito:
 * una fila por agente con el saldo pendiente del embargo activo.
 */

export interface FilaLiquidacionVisma {
  legajo: string
  monto: number
  fecha: string
}

const COLUMNAS = [
  'Legajo',
  'Concepto',
  'Parámetros',
  'Monto',
  'Fecha Desde',
  'Fecha Hasta',
  'Marca Retroactividad',
  'Período Desde',
  'Período Hasta',
]

export async function generarExcelLiquidacionVisma(filas: FilaLiquidacionVisma[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const hoja = workbook.addWorksheet('Interfaz')

  hoja.addRow(COLUMNAS)
  hoja.getRow(1).font = { bold: true }

  for (const fila of filas) {
    hoja.addRow([
      fila.legajo,
      '8500',
      '51',
      Number(fila.monto.toFixed(2)),
      fila.fecha,
      fila.fecha,
      'NO',
      '',
      '',
    ])
  }

  hoja.getColumn(4).numFmt = '0.00'
  hoja.columns.forEach((columna, indice) => {
    columna.width = indice === 0 ? 16 : indice === 3 ? 16 : indice === 4 || indice === 5 ? 14 : 18
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
