/**
 * Extracción de datos de oficios judiciales del Poder Judicial de Córdoba.
 *
 * Los PDFs llegan con formatos y redacciones muy variadas, por lo que el parser
 * combina patrones específicos (carátula, DNI, cuenta judicial, etc.) con
 * heurísticas de respaldo. Todo lo que no se pueda detectar queda vacío para que
 * el operador lo complete después de revisar la vista previa del PDF.
 */

export interface DatosOficio {
  /** N° de expediente judicial (SAC). Es el dato principal del oficio. */
  expediente: string
  /** Carátula / autos del expediente. */
  autos: string
  /** DNI de la persona embargada. */
  dni: string
  /** CUIL de la persona embargada, cuando aparece en el oficio. */
  cuil: string
  /** Nombre detectado en el cuerpo del oficio (referencia para la revisión). */
  nombreOficio: string
  /** Monto total del embargo. */
  monto: number
  /** N° de cuenta judicial. */
  cuenta: string
  /** Sucursal bancaria. */
  sucursal: string
  /** Juzgado / organismo interviniente. */
  juez: string
  /** Secretaría judicial. */
  secretaria: string
  /** Porcentaje de retención indicado en el oficio (0 si no se detectó). */
  porcentaje: number
  /** Fecha del oficio / expediente en formato dd/mm/aaaa. */
  fechaExpediente: string
  /** N° de oficio (sólo referencia; no es el expediente). */
  numeroOficio: string
  /** Tipo de proceso detectado en la carátula (referencia). */
  tipoProceso: string
  /** Datos que no se pudieron detectar y requieren revisión manual. */
  advertencias: string[]
}

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

const UNIDADES: Record<string, number> = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiuno: 21,
  veintiun: 21,
  veintiuna: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  doscientas: 200,
  trescientos: 300,
  trescientas: 300,
  cuatrocientos: 400,
  cuatrocientas: 400,
  quinientos: 500,
  quinientas: 500,
  seiscientos: 600,
  seiscientas: 600,
  setecientos: 700,
  setecientas: 700,
  ochocientos: 800,
  ochocientas: 800,
  novecientos: 900,
  novecientas: 900,
}

function normalize(text: string): string {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n[ ]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

function oneLine(text: string): string {
  return normalize(text).replace(/\s+/g, ' ')
}

function cleanSpaces(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—,:;"'“”]+|[\s\-–—,:;"'“”]+$/g, '')
    .trim()
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/** Quita puntos, espacios y guiones para comparar DNIs. */
export function normalizarDni(value: string | null | undefined): string {
  return onlyDigits(value ?? '')
}

function parseAmount(raw: string): number {
  let value = raw.replace(/\s/g, '').replace(/\$/g, '')
  if (!value) return 0

  if (value.includes(',')) {
    value = value.replace(/\./g, '').replace(',', '.')
  } else {
    const parts = value.split('.')
    if (parts.length > 2) {
      value = parts.join('')
    } else if (parts.length === 2) {
      // "751969.94" es decimal; "1.200.000" ya se resolvió arriba.
      if (parts[1].length !== 2) value = parts.join('')
    }
  }

  const parsed = Number(value.replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseSpanishNumber(phrase: string): number {
  const tokens = phrase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  let total = 0
  let current = 0
  let hasNumber = false

  for (const token of tokens) {
    if (token === 'y' || token === 'pesos' || token === 'peso' || token === 'de' || token === 'del') {
      continue
    }
    if (token === 'mil') {
      total += (current || 1) * 1000
      current = 0
      hasNumber = true
      continue
    }
    if (token === 'millon' || token === 'millones') {
      total += (current || 1) * 1_000_000
      current = 0
      hasNumber = true
      continue
    }
    const value = UNIDADES[token]
    if (value !== undefined) {
      current += value
      hasNumber = true
    }
  }

  const result = total + current
  return hasNumber && Number.isFinite(result) && result > 0 ? result : 0
}

function extractExpediente(text: string): string {
  const patterns = [
    /EXPEDIENTE\s+SAC\s*[:°º]?\s*(\d{4,12})/i,
    /EXPTE\.?\s*(?:N[°º]\.?|N[ÚU]MERO)?\s*[:°º]?\s*(\d{4,12})/i,
    /EXPEDIENTE\s+(?:N[°º]\.?|N[ÚU]MERO)?\s*[:°º]?\s*(\d{4,12})/i,
    /N[ÚU]MERO\s+DE\s+EXPEDIENTE\s*[:°º]?\s*(\d{4,12})/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1]
  }
  return ''
}

function extractAutos(text: string): string {
  const stop =
    /(?:\n\s*(?:Ref\s*\.?:?|C[OÓ]RDOBA\s*,|MUNICIPALIDAD|Municipalidad|S\s*_{2,}|AL\s+SR|SR\.?\s+INTENDENTE|Se\s+hace\s+saber|En\s+los\s+autos|VISTO|Expediente\s+SAC))/i

  const header = text.match(
    new RegExp(`EXPEDIENTE\\s+SAC\\s*[:°º]?\\s*\\d{4,12}\\s*-\\s*([\\s\\S]*?)(?=${stop.source})`, 'i'),
  )
  if (header) {
    const raw = cleanSpaces(header[1].replace(/\n/g, ' '))
    if (raw) return raw.slice(0, 500)
  }

  const caratula = text.match(
    /autos\s+caratulados\s*[":“”]?\s*([\s\S]*?)(?=,?\s*(?:Expte\.?|Expediente\s+SAC|que\s+se\s+tramitan|que\s+tramitan|Expediente\s+n)|\.\s*(?:Que|Se|A\s+fines))/i,
  )
  if (caratula) return cleanSpaces(caratula[1].replace(/\n/g, ' ')).slice(0, 500)

  return ''
}

function extractDni(text: string): string {
  const pattern = /(?:D\s*\.?\s*N\s*\.?\s*I\s*\.?|DNI)\s*(?:N[°º]\.?|:)?\s*([0-9][0-9.\s-]{5,18})/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    const digits = onlyDigits(match[1])
    if (digits.length >= 7 && digits.length <= 9) return digits
  }
  return ''
}

function extractCuil(text: string, dni: string): string {
  const pattern = /(?:C\s*\.?\s*U\s*\.?\s*I\s*\.?\s*L|CUIL)\s*(?:N[°º]\.?|:)?\s*([0-9][0-9\s-]{9,16})/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    const digits = onlyDigits(match[1])
    if (digits.length < 11 || digits.length > 12) continue
    const prefix = digits.slice(0, 2)
    if (!['20', '23', '24', '25', '26', '27'].includes(prefix)) continue
    const core = digits.slice(2, 10)
    if (!dni || core === dni || digits.includes(dni)) return digits
  }
  return ''
}

function extractDniFromCuil(text: string): string {
  const pattern = /(?:C\s*\.?\s*U\s*\.?\s*I\s*\.?\s*L|CUIL)\s*(?:N[°º]\.?|:)?\s*([0-9][0-9\s-]{9,16})/gi
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    const digits = onlyDigits(match[1])
    if (digits.length !== 11) continue
    const prefix = digits.slice(0, 2)
    if (!['20', '23', '24', '25', '26', '27'].includes(prefix)) continue
    return digits.slice(2, 10)
  }
  return ''
}

function extractMonto(text: string): number {
  const digitPatterns = [
    /(?:hasta\s+)?(?:cubrir|alcanzar)[^$]{0,160}?\$\s*([\d.,]+)/i,
    /(?:suma|monto)\s+(?:de\s+)?(?:pesos\s+)?[^$]{0,160}?\$\s*([\d.,]+)/i,
    /embargo[^$]{0,200}?\$\s*([\d.,]+)/i,
    /\$\s*([\d][\d.,]{3,})/,
  ]
  for (const pattern of digitPatterns) {
    const match = text.match(pattern)
    if (!match) continue
    const amount = parseAmount(match[1])
    if (amount > 0) return amount
  }

  // Respaldo: importes escritos sólo con palabras ("PESOS SEISCIENTOS DOS MIL").
  const words = text.match(
    /(?:hasta\s+)?(?:cubrir|alcanzar|suma|monto|embargo)[^.]{0,180}?pesos\s+(?:de\s+)?([a-záéíóúüñ\s]+?)(?=\s*(?:\(|\.|,|sobre|en\s+la|a\s+cuyo|$))/i,
  )
  if (words) {
    const amount = parseSpanishNumber(words[1])
    if (amount > 0) return amount
  }

  return 0
}

/**
 * La cuenta judicial suele venir como "922 / 18961209": el número anterior a la
 * barra es la sucursal y el posterior es la cuenta real.
 */
const CUENTA_PAR = /(?:CUENTA(?:\s+JUDICIAL)?(?:\s+(?:ACTIVA|A\s+LA\s+VISTA|ABIERTA|N[°º]\.?|N[ÚU]MERO))?[^0-9]{0,55})(\d{2,6})\s*\/\s*(\d{4,12})/i

function extractCuenta(text: string): string {
  const par = text.match(CUENTA_PAR)
  if (par) return par[2]

  const match = text.match(
    /(?:CUENTA(?:\s+JUDICIAL)?(?:\s+(?:ACTIVA|A\s+LA\s+VISTA|ABIERTA|N[°º]\.?|N[ÚU]MERO))?[^0-9]{0,25})(\d{5,12})\b/i,
  )
  if (match) return match[1]

  return ''
}

function extractSucursal(text: string): string {
  // Si la cuenta viene como "922 / 18961209", el 922 es la sucursal.
  const par = text.match(CUENTA_PAR)
  if (par) return par[1]

  const match = text.match(/Sucursal\s+([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)?)/i)
  if (!match) return ''

  const stop = new Set([
    'en',
    'a',
    'de',
    'del',
    'la',
    'el',
    'los',
    'las',
    'n',
    'n°',
    'expediente',
    'banco',
    'diligenciado',
    'con',
    'para',
    'por',
  ])
  return match[1]
    .trim()
    .split(/\s+/)
    .filter((word) => !stop.has(word.toLowerCase()))
    .slice(0, 2)
    .join(' ')
}

function extractTribunal(text: string): string {
  const patterns = [
    /que\s+se\s+tramitan\s+en\s+(?:esta|este)\s+(.+?)\s+se\s+ha\s+resuelto/i,
    /que\s+se\s+tramitan\s+por\s+ante\s+(?:el|este)\s+(.+?)\s+(?:secretar|se\s+ha\s+resuelto|a\s+cargo)/i,
    /que\s+tramitan\s+por\s+ante\s+(?:el|este)\s+(.+?)\s+(?:secretar|a\s+cargo)/i,
    /tramitan\s+por\s+ante\s+(?:el|este)\s+(.+?)\s+(?:secretar|a\s+cargo)/i,
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return cleanSpaces(match[1]).slice(0, 255)
  }
  return ''
}

function extractSecretaria(text: string, tribunal: string): string {
  let match = text.match(/Secretar[ií]a\s+N[°º]\.?\s*(\d{1,3}(?:\s*(?:y|,)\s*\d{1,3})?)/i)
  if (match) return cleanSpaces(match[1])

  if (tribunal) {
    match = tribunal.match(/(?:-|\b)SEC(?:RETAR[IÍ]A)?\.?\s*(?:N[°º]\.?\s*)?(\d{1,3}(?:\s*(?:y|,)\s*\d{1,3})?)/i)
    if (match) return cleanSpaces(match[1])
  }

  return ''
}

function extractPorcentaje(text: string): number {
  const match = text.match(/(\d{1,2})\s*%/i)
  return match ? Number(match[1]) : 0
}

function extractFecha(text: string): string {
  let match = text.match(/C[OÓ]RDOBA\s*,\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})/i)
  if (match) {
    return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`
  }

  match = text.match(/C[oó]rdoba\s*,\s*(\d{1,2})\s*de\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)\s*(?:del?\s*)?(\d{4})/i)
  if (match) {
    const month = MESES[match[2].toLowerCase()]
    if (month) {
      return `${match[1].padStart(2, '0')}/${String(month).padStart(2, '0')}/${match[3]}`
    }
  }

  match = text.match(/Fecha\s*:\s*(\d{4})\.(\d{2})\.(\d{2})/i)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`

  return ''
}

function extractOficio(text: string, fileName: string): string {
  const match = text.match(/N[úu]mero\s+de\s+oficio\s*:\s*(\d{5,15})/i)
  if (match) return match[1]
  return fileName.match(/(\d{6,15})/)?.[1] ?? ''
}

function extractTipoProceso(autos: string): string {
  if (!autos) return ''
  const parts = autos.split(/\s+-\s+/)
  return parts.length >= 3 ? parts.slice(2).join(' - ') : ''
}

function extractNombreOficio(text: string): string {
  const match = text.match(
    /(?:Sra?\.?|demandad[oa]|emplead[oa]|percibe|haberes)[^.]{0,120}?([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’.,-]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ'’.,-]+){1,4})\s*,?\s*(?:D\s*\.?\s*N\s*\.?\s*I\s*\.?)/,
  )
  return match ? cleanSpaces(match[1]) : ''
}

export function parseOficio(rawText: string, fileName = ''): DatosOficio {
  const text = normalize(rawText)
  const flat = oneLine(rawText)

  const expediente = extractExpediente(flat)
  const autos = extractAutos(text)
  let dni = extractDni(flat)
  let cuil = extractCuil(flat, dni)
  if (!dni) {
    dni = extractDniFromCuil(flat)
    if (dni) cuil = extractCuil(flat, dni)
  }
  const monto = extractMonto(flat)
  const cuenta = extractCuenta(flat)
  const sucursal = extractSucursal(flat)
  const juez = extractTribunal(flat)
  const secretaria = extractSecretaria(flat, juez)
  const porcentaje = extractPorcentaje(flat)
  const fechaExpediente = extractFecha(flat)
  const numeroOficio = extractOficio(flat, fileName)
  const tipoProceso = extractTipoProceso(autos)
  const nombreOficio = extractNombreOficio(flat)

  const advertencias: string[] = []
  if (!expediente) advertencias.push('No se pudo detectar el N° de expediente judicial.')
  if (!autos) advertencias.push('No se pudo detectar la carátula (autos).')
  if (!dni) advertencias.push('No se pudo detectar el DNI.')
  if (!monto) advertencias.push('No se pudo detectar el monto del embargo.')
  if (!cuenta) advertencias.push('No se pudo detectar el N° de cuenta judicial.')

  return {
    expediente,
    autos,
    dni,
    cuil,
    nombreOficio,
    monto,
    cuenta,
    sucursal,
    juez,
    secretaria,
    porcentaje,
    fechaExpediente,
    numeroOficio,
    tipoProceso,
    advertencias,
  }
}
