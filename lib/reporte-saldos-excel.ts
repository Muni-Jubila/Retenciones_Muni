import ExcelJS from 'exceljs'
import { periodoLabel, getEstadoConfig } from '@/lib/embargos'
import { fechaHoraBuenosAires } from '@/lib/timezone'
import type { ReporteSaldosResult } from '@/lib/reporte-saldos'

/**
 * Genera el Excel del reporte de saldos en curso: una hoja con la evolución
 * mensual y otra con el detalle del mes seleccionado.
 */

const AZUL = 'FF1E3A8A'
const AZUL_CLARO = 'FFEFF6FF'
const GRIS_CLARO = 'FFF1F5F9'
const GRIS = 'FF64748B'
const TEXTO = 'FF0F172A'
const BORDE = 'FFE2E8F0'
const ROJO = 'FFB91C1C'
const VERDE = 'FF15803D'

const FORMATO_MONEDA = '#,##0.00'

function bordeFino(): Partial<ExcelJS.Borders> {
  return {
    top: { style: 'thin', color: { argb: BORDE } },
    left: { style: 'thin', color: { argb: BORDE } },
    bottom: { style: 'thin', color: { argb: BORDE } },
    right: { style: 'thin', color: { argb: BORDE } },
  }
}

function pintarTitulo(hoja: ExcelJS.Worksheet, rango: string, texto: string) {
  hoja.mergeCells(rango)
  const celda = hoja.getCell(rango.split(':')[0])
  celda.value = texto
  celda.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
  celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function pintarSubtitulo(hoja: ExcelJS.Worksheet, rango: string, texto: string, negrita = false) {
  hoja.mergeCells(rango)
  const celda = hoja.getCell(rango.split(':')[0])
  celda.value = texto
  celda.font = { size: 10, bold: negrita, color: { argb: negrita ? TEXTO : GRIS } }
  celda.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
}

function celdaResumen(
  hoja: ExcelJS.Worksheet,
  fila: number,
  columna: number,
  etiqueta: string,
  valor: string | number,
  formato?: string,
  colorValor?: string,
) {
  const label = hoja.getCell(fila, columna)
  label.value = etiqueta
  label.font = { size: 8, bold: true, color: { argb: GRIS } }
  label.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } }
  label.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  label.border = bordeFino()

  const value = hoja.getCell(fila, columna + 1)
  value.value = valor
  value.font = { size: 11, bold: true, color: { argb: colorValor ?? TEXTO } }
  value.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
  value.border = bordeFino()
  if (formato) value.numFmt = formato
}

export async function generarExcelReporteSaldos(data: ReporteSaldosResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Sistema de Retenciones'
  workbook.created = new Date()
  const periodo = data.periodo ?? ''
  const etiquetaPeriodo = periodoLabel(periodo)

  // ---------------------------------------------------------------- Resumen
  const resumen = workbook.addWorksheet('Resumen', {
    properties: { tabColor: { argb: AZUL } },
  })

  pintarTitulo(resumen, 'A1:F1', 'SALDOS EN CURSO POR MES')
  resumen.getRow(1).height = 30
  pintarSubtitulo(resumen, 'A2:F2', 'Sistema de Retenciones · Municipalidad de Córdoba')
  pintarSubtitulo(
    resumen,
    'A3:F3',
    `Mes de cierre: ${etiquetaPeriodo} · Generado: ${fechaHoraBuenosAires(new Date())}`,
  )
  resumen.getRow(2).height = 18
  resumen.getRow(3).height = 18

  const totales = data.totales
  celdaResumen(resumen, 5, 1, 'EMBARGOS VIGENTES', totales?.embargos ?? 0)
  celdaResumen(resumen, 5, 3, 'DEUDA TOTAL', totales?.deuda ?? 0, FORMATO_MONEDA)
  celdaResumen(resumen, 5, 5, 'RETENIDO DEL MES', totales?.retenidoMes ?? 0, FORMATO_MONEDA, VERDE)
  celdaResumen(resumen, 6, 1, 'RETENIDO HASTA EL MES', totales?.retenidoAcumulado ?? 0, FORMATO_MONEDA, VERDE)
  celdaResumen(resumen, 6, 3, 'SALDO PENDIENTE', totales?.saldo ?? 0, FORMATO_MONEDA, ROJO)
  celdaResumen(resumen, 6, 5, 'MES DE CIERRE', etiquetaPeriodo)

  resumen.getRow(8).height = 20
  const tituloTabla = resumen.getCell('A8')
  tituloTabla.value = 'EVOLUCIÓN MENSUAL'
  tituloTabla.font = { size: 10, bold: true, color: { argb: AZUL } }

  const encabezados = [
    'Mes',
    'Embargos',
    'Deuda total',
    'Retenido del mes',
    'Retenido acumulado',
    'Saldo pendiente',
  ]
  const filaEncabezado = 9
  encabezados.forEach((texto, indice) => {
    const celda = resumen.getCell(filaEncabezado, indice + 1)
    celda.value = texto
    celda.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = {
      vertical: 'middle',
      horizontal: indice === 0 ? 'left' : 'right',
      indent: indice === 0 ? 1 : 0,
    }
    celda.border = bordeFino()
  })
  resumen.getRow(filaEncabezado).height = 22

  data.meses.forEach((mes, indice) => {
    const fila = filaEncabezado + 1 + indice
    const seleccionado = mes.periodo === periodo
    const valores: (string | number)[] = [
      periodoLabel(mes.periodo),
      mes.embargos,
      mes.deuda,
      mes.retenidoMes,
      mes.retenidoAcumulado,
      mes.saldo,
    ]
    valores.forEach((valor, columna) => {
      const celda = resumen.getCell(fila, columna + 1)
      celda.value = valor
      celda.font = {
        size: 10,
        bold: seleccionado || columna === 0,
        color: { argb: TEXTO },
      }
      celda.alignment = {
        vertical: 'middle',
        horizontal: columna === 0 ? 'left' : 'right',
        indent: columna === 0 ? 1 : 0,
      }
      celda.border = bordeFino()
      if (columna >= 2) celda.numFmt = FORMATO_MONEDA
      if (seleccionado) {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } }
      }
      if (columna === 5) {
        celda.font = { ...celda.font, color: { argb: Number(valor) > 0 ? ROJO : VERDE } }
      }
    })
    resumen.getRow(fila).height = 18
  })

  const filaNota = filaEncabezado + data.meses.length + 1
  pintarSubtitulo(
    resumen,
    `A${filaNota}:F${filaNota}`,
    'El saldo corresponde a los embargos vigentes al cierre de cada mes. Los meses posteriores al actual se muestran como proyección, sin retenciones futuras.',
  )
  resumen.getRow(filaNota).height = 26
  resumen.getCell(`A${filaNota}`).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 }

  resumen.columns = [
    { width: 16 },
    { width: 12 },
    { width: 18 },
    { width: 19 },
    { width: 21 },
    { width: 19 },
  ]

  resumen.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  }
  resumen.headerFooter = {
    oddFooter: '&L Sistema de Retenciones &C &A &R Página &P de &N',
  }

  // ---------------------------------------------------------------- Detalle
  const nombreHojaDetalle = `Detalle ${etiquetaPeriodo}`.replace(/[*?:\\/\[\]]/g, '-').slice(0, 31)
  const detalle = workbook.addWorksheet(nombreHojaDetalle, {
    properties: { tabColor: { argb: 'FF15803D' } },
  })

  pintarTitulo(detalle, 'A1:G1', `DETALLE AL CIERRE DE ${etiquetaPeriodo.toUpperCase()}`)
  detalle.getRow(1).height = 30
  pintarSubtitulo(
    detalle,
    'A2:G2',
    `Embargos vigentes al cierre del mes · Deuda, retenido y saldo por embargo`,
  )
  detalle.getRow(2).height = 18

  const encabezadosDetalle = [
    'Agente',
    'DNI',
    'Expediente',
    'Estado',
    'Deuda',
    'Retenido',
    'Saldo',
  ]
  const filaEncabezadoDetalle = 4
  encabezadosDetalle.forEach((texto, indice) => {
    const celda = detalle.getCell(filaEncabezadoDetalle, indice + 1)
    celda.value = texto
    celda.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    celda.alignment = {
      vertical: 'middle',
      horizontal: indice >= 4 ? 'right' : 'left',
      indent: indice <= 1 ? 1 : 0,
    }
    celda.border = bordeFino()
  })
  detalle.getRow(filaEncabezadoDetalle).height = 22

  let fila = filaEncabezadoDetalle + 1
  if (data.detalle.length === 0) {
    detalle.mergeCells(`A${fila}:G${fila}`)
    const celda = detalle.getCell(`A${fila}`)
    celda.value = 'No hay embargos vigentes al cierre de ese mes.'
    celda.font = { size: 10, italic: true, color: { argb: GRIS } }
    celda.alignment = { vertical: 'middle', horizontal: 'center', indent: 1 }
    celda.border = bordeFino()
    detalle.getRow(fila).height = 22
    fila += 1
  } else {
    data.detalle.forEach((item, indice) => {
      const valores: (string | number)[] = [
        item.agente || '—',
        item.dni || '—',
        item.expediente || '—',
        getEstadoConfig(item.estado).label,
        item.deuda,
        item.retenido,
        item.saldo,
      ]
      valores.forEach((valor, columna) => {
        const celda = detalle.getCell(fila, columna + 1)
        celda.value = valor
        celda.font = { size: 10, color: { argb: TEXTO } }
        celda.alignment = {
          vertical: 'middle',
          horizontal: columna >= 4 ? 'right' : 'left',
          indent: columna <= 1 ? 1 : 0,
        }
        celda.border = bordeFino()
        if (columna >= 4) celda.numFmt = FORMATO_MONEDA
        if (columna === 6) {
          celda.font = { ...celda.font, bold: true, color: { argb: Number(valor) > 0 ? ROJO : VERDE } }
        }
        if (indice % 2 === 1) {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
      detalle.getRow(fila).height = 18
      fila += 1
    })

    // Fila de totales
    const filaTotal = fila
    detalle.mergeCells(`A${filaTotal}:D${filaTotal}`)
    const totalLabel = detalle.getCell(`A${filaTotal}`)
    totalLabel.value = 'TOTAL'
    totalLabel.font = { bold: true, size: 10, color: { argb: TEXTO } }
    totalLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 }
    totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } }
    totalLabel.border = bordeFino()

    const totalesDetalle = data.detalle.reduce(
      (acc, item) => {
        acc.deuda += item.deuda
        acc.retenido += item.retenido
        acc.saldo += item.saldo
        return acc
      },
      { deuda: 0, retenido: 0, saldo: 0 },
    )
    const valoresTotales = [totalesDetalle.deuda, totalesDetalle.retenido, totalesDetalle.saldo]
    valoresTotales.forEach((valor, indice) => {
      const celda = detalle.getCell(filaTotal, 5 + indice)
      celda.value = Number(valor.toFixed(2))
      celda.font = { bold: true, size: 10, color: { argb: indice === 2 ? ROJO : TEXTO } }
      celda.alignment = { vertical: 'middle', horizontal: 'right' }
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS_CLARO } }
      celda.border = bordeFino()
      celda.numFmt = FORMATO_MONEDA
    })
    detalle.getRow(filaTotal).height = 20

    detalle.autoFilter = {
      from: { row: filaEncabezadoDetalle, column: 1 },
      to: { row: fila - 1, column: 7 },
    }
  }

  detalle.views = [{ state: 'frozen', ySplit: filaEncabezadoDetalle }]
  detalle.columns = [
    { width: 38 },
    { width: 14 },
    { width: 16 },
    { width: 15 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ]
  detalle.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    printTitlesRow: `${filaEncabezadoDetalle}:${filaEncabezadoDetalle}`,
  }
  detalle.headerFooter = {
    oddFooter: '&L Sistema de Retenciones &C &A &R Página &P de &N',
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
