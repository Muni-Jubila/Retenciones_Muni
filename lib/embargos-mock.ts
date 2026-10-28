import type { Empleado } from '@/lib/empleados'
import {
  formatExpedienteRetenciones,
  formatMoney,
  parseMoneyInput,
  roundMoney,
  periodoActual,
  periodoLabel,
  type ConsultaEmbargosFiltros,
  type Embargo,
  type EmbargoInput,
  type EstadoEmbargo,
  type ResumenRetencion,
  type RetencionEmbargo,
  type RetencionInput,
} from '@/lib/embargos'

// ---------- Datos de ejemplo ----------

const MOCK_AGENTES: Empleado[] = [
  {
    id: 1,
    dni: '20123456',
    cuil: '20-20123456-3',
    apellido: 'GOMEZ',
    segundoApellido: '',
    nombre: 'JUAN',
    segundoNombre: '',
    nombreCompleto: 'GOMEZ, JUAN',
    sexo: 'M',
    fechaNacimiento: '10/05/1980',
    edadActual: '46',
    estadoActivo: true,
    regimen: 'JUBILACION ORDINARIA',
    secretaria: 'HACIENDA',
    programa: 'PROGRAMA 1',
    cargo: 'EMPLEADO ADMINISTRATIVO',
    telefono: '3834-123456',
    correo: 'juan.gomez@municipio.gob.ar',
    antiguedadRecibo: '15 años',
    antiguedadLicencias: '15 años',
  },
  {
    id: 2,
    dni: '27987654',
    cuil: '27-27987654-9',
    apellido: 'PEREZ',
    segundoApellido: 'LOPEZ',
    nombre: 'MARIA',
    segundoNombre: '',
    nombreCompleto: 'PEREZ LOPEZ, MARIA',
    sexo: 'F',
    fechaNacimiento: '22/11/1975',
    edadActual: '50',
    estadoActivo: true,
    regimen: 'JUBILACION ORDINARIA',
    secretaria: 'SALUD',
    programa: 'PROGRAMA 2',
    cargo: 'ENFERMERA',
    telefono: '3834-654321',
    correo: 'maria.perez@municipio.gob.ar',
    antiguedadRecibo: '20 años',
    antiguedadLicencias: '20 años',
  },
]

let nextEmbargoId = 100
let nextRetencionId = 1000

interface MockRetencion {
  id: number
  idEmbargo: number
  periodo: string
  sueldo: number
  refrigerio: number
  retencionMensual: number
  saldo: number
  devolucion: number
  observaciones: string
  fechaRegistro: string
}

interface MockEmbargo {
  id: number
  idAgente: number
  dni: string
  agente: string
  estado: EstadoEmbargo
  autos: string
  expediente: string
  nroExpedienteRetenciones?: number
  fechaExpediente: string
  cuenta: string
  sucursal: string
  juez: string
  instancia: string
  nomenclatura: string
  tipoProceso: string
  secretaria: string
  deuda: number
  importeMensual: number
  porcentaje: number
  marcaEspecial: string
  observaciones: string
  fechaAlta: string
  fechaBaja: string
  motivoBaja: string
  programa: string
  secretariaAgente: string
  cargo: string
  retenciones: MockRetencion[]
}

const hoy = new Date().toISOString().slice(0, 10)

const mockEmbargos: MockEmbargo[] = [
  {
    id: 1,
    idAgente: 1,
    dni: '20123456',
    agente: 'GOMEZ, JUAN',
    estado: 'ACTIVO',
    autos: 'JUZGADO CIVIL N° 3 - EXPTE. 1234/2024',
    expediente: '1234/2024',
    fechaExpediente: '15/03/2024',
    cuenta: '456789',
    sucursal: 'BNA CATAMARCA',
    juez: 'Dr. Juan Perez',
    instancia: '1° Instancia',
    nomenclatura: 'CIVIL',
    tipoProceso: 'Ejecutivo',
    secretaria: 'Secretaría Civil N° 2',
    deuda: 120000,
    importeMensual: 15000,
    porcentaje: 0,
    marcaEspecial: 'N',
    observaciones: 'Embargo judicial por deuda bancaria.',
    fechaAlta: hoy,
    fechaBaja: '',
    motivoBaja: '',
    programa: 'PROGRAMA 1',
    secretariaAgente: 'HACIENDA',
    cargo: 'EMPLEADO ADMINISTRATIVO',
    retenciones: [
      { id: 1001, idEmbargo: 1, periodo: '2024-03', sueldo: 80000, refrigerio: 5000, retencionMensual: 15000, saldo: 105000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
      { id: 1002, idEmbargo: 1, periodo: '2024-04', sueldo: 80000, refrigerio: 5000, retencionMensual: 15000, saldo: 90000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
    ],
  },
  {
    id: 2,
    idAgente: 1,
    dni: '20123456',
    agente: 'GOMEZ, JUAN',
    estado: 'ESPERA',
    autos: 'JUZGADO LABORAL N° 1',
    expediente: '567/2025',
    fechaExpediente: '02/02/2025',
    cuenta: '112233',
    sucursal: 'GALICIA',
    juez: 'Dra. Ana Gomez',
    instancia: '1° Instancia',
    nomenclatura: 'LABORAL',
    tipoProceso: 'Ordinario',
    secretaria: 'Secretaría Laboral',
    deuda: 45000,
    importeMensual: 0,
    porcentaje: 20,
    marcaEspecial: 'E',
    observaciones: 'Pendiente de imputación.',
    fechaAlta: hoy,
    fechaBaja: '',
    motivoBaja: '',
    programa: 'PROGRAMA 1',
    secretariaAgente: 'HACIENDA',
    cargo: 'EMPLEADO ADMINISTRATIVO',
    retenciones: [],
  },
  {
    id: 3,
    idAgente: 1,
    dni: '20123456',
    agente: 'GOMEZ, JUAN',
    estado: 'BAJA',
    autos: 'JUZGADO CIVIL N° 5',
    expediente: '999/2023',
    fechaExpediente: '10/10/2023',
    cuenta: '778899',
    sucursal: 'MACRO',
    juez: 'Dr. Carlos Ruiz',
    instancia: '2° Instancia',
    nomenclatura: 'CIVIL',
    tipoProceso: 'Ejecutivo',
    secretaria: 'Secretaría Civil N° 1',
    deuda: 30000,
    importeMensual: 5000,
    porcentaje: 0,
    marcaEspecial: '',
    observaciones: 'Dado de baja por renuncia.',
    fechaAlta: hoy,
    fechaBaja: hoy,
    motivoBaja: 'Renuncia',
    programa: 'PROGRAMA 1',
    secretariaAgente: 'HACIENDA',
    cargo: 'EMPLEADO ADMINISTRATIVO',
    retenciones: [
      { id: 1003, idEmbargo: 3, periodo: '2023-11', sueldo: 60000, refrigerio: 4000, retencionMensual: 5000, saldo: 25000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
    ],
  },
  {
    id: 4,
    idAgente: 2,
    dni: '27987654',
    agente: 'PEREZ LOPEZ, MARIA',
    estado: 'CANCELADO',
    autos: 'JUZGADO COMERCIAL N° 2',
    expediente: '4321/2022',
    fechaExpediente: '01/06/2022',
    cuenta: '334455',
    sucursal: 'SANTANDER',
    juez: 'Dra. Laura Diaz',
    instancia: '1° Instancia',
    nomenclatura: 'COMERCIAL',
    tipoProceso: 'Ejecutivo',
    secretaria: 'Secretaría Comercial',
    deuda: 20000,
    importeMensual: 4000,
    porcentaje: 0,
    marcaEspecial: '',
    observaciones: 'Deuda cancelada.',
    fechaAlta: hoy,
    fechaBaja: hoy,
    motivoBaja: 'Deuda cancelada',
    programa: 'PROGRAMA 2',
    secretariaAgente: 'SALUD',
    cargo: 'ENFERMERA',
    retenciones: [
      { id: 1004, idEmbargo: 4, periodo: '2022-07', sueldo: 70000, refrigerio: 3000, retencionMensual: 4000, saldo: 16000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
      { id: 1005, idEmbargo: 4, periodo: '2022-08', sueldo: 70000, refrigerio: 3000, retencionMensual: 4000, saldo: 12000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
      { id: 1006, idEmbargo: 4, periodo: '2022-09', sueldo: 70000, refrigerio: 3000, retencionMensual: 4000, saldo: 8000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
      { id: 1007, idEmbargo: 4, periodo: '2022-10', sueldo: 70000, refrigerio: 3000, retencionMensual: 4000, saldo: 4000, devolucion: 0, observaciones: '', fechaRegistro: hoy },
      { id: 1008, idEmbargo: 4, periodo: '2022-11', sueldo: 70000, refrigerio: 3000, retencionMensual: 4000, saldo: 0, devolucion: 0, observaciones: 'Último mes', fechaRegistro: hoy },
    ],
  },
]

// ---------- Helpers ----------

function agenteDe(id: number): Empleado | undefined {
  return MOCK_AGENTES.find((a) => a.id === id)
}

function mapEmbargo(m: MockEmbargo): Embargo {
  const retenciones = [...m.retenciones].sort((a, b) => a.periodo.localeCompare(b.periodo))
  const totalRetenido = roundMoney(retenciones.reduce((acc, r) => acc + r.retencionMensual, 0))
  const totalDevuelto = roundMoney(retenciones.reduce((acc, r) => acc + r.devolucion, 0))
  const ultima = retenciones[retenciones.length - 1]
  const saldoActual = ultima ? ultima.saldo : roundMoney(m.deuda - totalRetenido + totalDevuelto)
  return {
    id: m.id,
    idAgente: m.idAgente,
    dni: m.dni || agenteDe(m.idAgente)?.dni || '',
    agente: m.agente || agenteDe(m.idAgente)?.nombreCompleto || '',
    estado: m.estado,
    autos: m.autos,
    expediente: m.expediente,
    expedienteRetenciones: formatExpedienteRetenciones(m.nroExpedienteRetenciones ?? m.id),
    fechaExpediente: m.fechaExpediente,
    cuenta: m.cuenta,
    sucursal: m.sucursal,
    juez: m.juez,
    instancia: m.instancia,
    nomenclatura: m.nomenclatura,
    tipoProceso: m.tipoProceso,
    secretaria: m.secretaria,
    deuda: m.deuda,
    importeMensual: m.importeMensual,
    porcentaje: m.porcentaje,
    marcaEspecial: m.marcaEspecial,
    observaciones: m.observaciones,
    fechaAlta: m.fechaAlta,
    fechaBaja: m.fechaBaja,
    motivoBaja: m.motivoBaja,
    saldoActual,
    totalRetenido,
    totalDevuelto,
    cantidadRetenciones: retenciones.length,
    primerPeriodo: retenciones[0]?.periodo ?? '',
    ultimoPeriodo: ultima?.periodo ?? '',
    programa: m.programa,
    secretariaAgente: m.secretariaAgente,
    cargo: m.cargo,
  }
}

function recalcularSaldosMock(idEmbargo: number): number | null {
  const m = mockEmbargos.find((e) => e.id === idEmbargo)
  if (!m) return null
  let saldo = m.deuda
  for (const r of m.retenciones.sort((a, b) => a.periodo.localeCompare(b.periodo))) {
    saldo = roundMoney(saldo - r.retencionMensual + r.devolucion)
    r.saldo = saldo
  }
  if (saldo <= 0 && (m.estado === 'ACTIVO' || m.estado === 'ESPERA')) {
    m.estado = 'CANCELADO'
    m.fechaBaja = hoy
    m.motivoBaja = 'Deuda cancelada'
  } else if (saldo > 0 && m.estado === 'CANCELADO' && m.motivoBaja === 'Deuda cancelada') {
    m.estado = 'ACTIVO'
    m.fechaBaja = ''
    m.motivoBaja = ''
  }
  return saldo
}

// ---------- Exports (mismo contrato que app/actions/embargos.ts) ----------

export async function listarEmbargosDeAgente(idAgente: number, empleado?: Empleado | null): Promise<Embargo[]> {
  // En modo mock usamos los embargos de ejemplo como plantilla y los reasignamos
  // al agente real que se está viendo, enriqueciendo con sus datos personales.
  const base = mockEmbargos.filter((m) => m.idAgente === 1)
  const clones = base.map((m) => ({
    ...m,
    id: m.id,
    idAgente,
    dni: empleado?.dni ?? m.dni,
    agente: empleado?.nombreCompleto ?? m.agente,
    programa: empleado?.programa ?? m.programa,
    secretariaAgente: empleado?.secretaria ?? m.secretariaAgente,
    cargo: empleado?.cargo ?? m.cargo,
    retenciones: m.retenciones.map((r) => ({ ...r, idEmbargo: m.id })),
  }))
  return clones.map(mapEmbargo).sort((a, b) => b.id - a.id)
}

export async function crearEmbargo(input: EmbargoInput): Promise<{ ok: boolean; error?: string; field?: string; embargo?: Embargo }> {
  const agente = agenteDe(input.idAgente)
  if (!agente) return { ok: false, error: 'El agente no existe.' }
  const nuevo: MockEmbargo = {
    id: ++nextEmbargoId,
    idAgente: input.idAgente,
    dni: '',
    agente: '',
    estado: (input.estado as EstadoEmbargo) || 'ESPERA',
    autos: input.autos.trim(),
    expediente: input.expediente.trim(),
    fechaExpediente: input.fechaExpediente.trim(),
    cuenta: input.cuenta.trim(),
    sucursal: input.sucursal.trim(),
    juez: input.juez.trim(),
    instancia: input.instancia.trim(),
    nomenclatura: input.nomenclatura.trim(),
    tipoProceso: input.tipoProceso.trim(),
    secretaria: input.secretaria.trim(),
    deuda: parseMoneyInput(input.deuda),
    importeMensual: parseMoneyInput(input.importeMensual),
    porcentaje: parseMoneyInput(input.porcentaje),
    marcaEspecial: input.marcaEspecial.trim(),
    observaciones: input.observaciones.trim(),
    fechaAlta: hoy,
    fechaBaja: '',
    motivoBaja: '',
    programa: agente.programa,
    secretariaAgente: agente.secretaria,
    cargo: agente.cargo,
    retenciones: [],
  }
  if (nuevo.estado === 'BAJA' || nuevo.estado === 'CANCELADO') {
    nuevo.fechaBaja = hoy
    nuevo.motivoBaja = `Creado como ${nuevo.estado.toLowerCase()}`
  }
  mockEmbargos.push(nuevo)
  return { ok: true, embargo: mapEmbargo(nuevo) }
}

export async function actualizarEmbargo(id: number, input: EmbargoInput): Promise<{ ok: boolean; error?: string; field?: string; embargo?: Embargo }> {
  const m = mockEmbargos.find((e) => e.id === id)
  if (!m) return { ok: false, error: 'El embargo no existe.' }
  const estadoAnterior = m.estado
  m.estado = (input.estado as EstadoEmbargo) || m.estado
  m.autos = input.autos.trim()
  m.expediente = input.expediente.trim()
  m.fechaExpediente = input.fechaExpediente.trim()
  m.cuenta = input.cuenta.trim()
  m.sucursal = input.sucursal.trim()
  m.juez = input.juez.trim()
  m.instancia = input.instancia.trim()
  m.nomenclatura = input.nomenclatura.trim()
  m.tipoProceso = input.tipoProceso.trim()
  m.secretaria = input.secretaria.trim()
  m.deuda = parseMoneyInput(input.deuda)
  m.importeMensual = parseMoneyInput(input.importeMensual)
  m.porcentaje = parseMoneyInput(input.porcentaje)
  m.marcaEspecial = input.marcaEspecial.trim()
  m.observaciones = input.observaciones.trim()
  if (m.estado === 'BAJA' || m.estado === 'CANCELADO') {
    m.fechaBaja = hoy
    if (estadoAnterior !== 'BAJA' && estadoAnterior !== 'CANCELADO') m.motivoBaja = `Cambio de estado a ${m.estado.toLowerCase()}`
  } else {
    m.fechaBaja = ''
    m.motivoBaja = ''
  }
  recalcularSaldosMock(m.id)
  return { ok: true, embargo: mapEmbargo(m) }
}

export async function cambiarEstadoEmbargo(id: number, estado: string, motivo?: string): Promise<{ ok: boolean; error?: string; embargo?: Embargo }> {
  const m = mockEmbargos.find((e) => e.id === id)
  if (!m) return { ok: false, error: 'El embargo no existe.' }
  m.estado = estado as EstadoEmbargo
  const cierra = estado === 'BAJA' || estado === 'CANCELADO'
  m.fechaBaja = cierra ? hoy : ''
  m.motivoBaja = cierra ? motivo?.trim() || `Cambio de estado a ${estado.toLowerCase()}` : ''
  return { ok: true, embargo: mapEmbargo(m) }
}

export async function eliminarEmbargo(id: number): Promise<{ ok: boolean; error?: string }> {
  const idx = mockEmbargos.findIndex((e) => e.id === id)
  if (idx === -1) return { ok: false, error: 'El embargo no existe.' }
  mockEmbargos.splice(idx, 1)
  return { ok: true }
}

export async function listarRetenciones(idEmbargo: number): Promise<RetencionEmbargo[]> {
  const m = mockEmbargos.find((e) => e.id === idEmbargo)
  if (!m) return []
  return [...m.retenciones]
    .sort((a, b) => a.periodo.localeCompare(b.periodo))
    .map((r) => ({
      id: r.id,
      idEmbargo: r.idEmbargo,
      periodo: r.periodo,
      sueldo: r.sueldo,
      refrigerio: r.refrigerio,
      retencionMensual: r.retencionMensual,
      saldo: r.saldo,
      devolucion: r.devolucion,
      observaciones: r.observaciones,
      fechaRegistro: r.fechaRegistro,
    }))
}

export async function crearRetencion(input: RetencionInput): Promise<{ ok: boolean; error?: string; field?: string; retencion?: RetencionEmbargo; saldoActual?: number }> {
  const m = mockEmbargos.find((e) => e.id === input.idEmbargo)
  if (!m) return { ok: false, error: 'El embargo no existe.' }
  if (m.retenciones.some((r) => r.periodo === input.periodo)) {
    return { ok: false, error: `Ya existe una retención para ${periodoLabel(input.periodo)}.`, field: 'periodo' }
  }
  const retencion = parseMoneyInput(input.retencionMensual)
  const devolucion = parseMoneyInput(input.devolucion)
  if (retencion === 0 && devolucion === 0) return { ok: false, error: 'Ingrese una retención o una devolución.', field: 'retencionMensual' }
  const nueva: MockRetencion = {
    id: ++nextRetencionId,
    idEmbargo: input.idEmbargo,
    periodo: input.periodo,
    sueldo: parseMoneyInput(input.sueldo),
    refrigerio: parseMoneyInput(input.refrigerio),
    retencionMensual: retencion,
    saldo: 0,
    devolucion,
    observaciones: input.observaciones.trim(),
    fechaRegistro: hoy,
  }
  m.retenciones.push(nueva)
  const saldoFinal = recalcularSaldosMock(m.id)
  const actual = m.retenciones.find((r) => r.id === nueva.id)!
  return {
    ok: true,
    retencion: {
      id: actual.id,
      idEmbargo: actual.idEmbargo,
      periodo: actual.periodo,
      sueldo: actual.sueldo,
      refrigerio: actual.refrigerio,
      retencionMensual: actual.retencionMensual,
      saldo: actual.saldo,
      devolucion: actual.devolucion,
      observaciones: actual.observaciones,
      fechaRegistro: actual.fechaRegistro,
    },
    saldoActual: saldoFinal ?? undefined,
  }
}

export async function actualizarRetencion(id: number, input: Omit<RetencionInput, 'idEmbargo'>): Promise<{ ok: boolean; error?: string; field?: string; retencion?: RetencionEmbargo; saldoActual?: number }> {
  let found: MockRetencion | undefined
  let owner: MockEmbargo | undefined
  for (const m of mockEmbargos) {
    const r = m.retenciones.find((x) => x.id === id)
    if (r) { found = r; owner = m; break }
  }
  if (!found || !owner) return { ok: false, error: 'La retención no existe.' }
  if (owner.retenciones.some((r) => r.periodo === input.periodo && r.id !== id)) {
    return { ok: false, error: `Ya existe una retención para ${periodoLabel(input.periodo)}.`, field: 'periodo' }
  }
  found.periodo = input.periodo
  found.sueldo = parseMoneyInput(input.sueldo)
  found.refrigerio = parseMoneyInput(input.refrigerio)
  found.retencionMensual = parseMoneyInput(input.retencionMensual)
  found.devolucion = parseMoneyInput(input.devolucion)
  found.observaciones = input.observaciones.trim()
  const saldoFinal = recalcularSaldosMock(owner.id)
  return {
    ok: true,
    retencion: {
      id: found.id,
      idEmbargo: found.idEmbargo,
      periodo: found.periodo,
      sueldo: found.sueldo,
      refrigerio: found.refrigerio,
      retencionMensual: found.retencionMensual,
      saldo: found.saldo,
      devolucion: found.devolucion,
      observaciones: found.observaciones,
      fechaRegistro: found.fechaRegistro,
    },
    saldoActual: saldoFinal ?? undefined,
  }
}

export async function eliminarRetencion(id: number): Promise<{ ok: boolean; error?: string; saldoActual?: number }> {
  for (const m of mockEmbargos) {
    const idx = m.retenciones.findIndex((r) => r.id === id)
    if (idx !== -1) {
      m.retenciones.splice(idx, 1)
      const saldoFinal = recalcularSaldosMock(m.id)
      return { ok: true, saldoActual: saldoFinal ?? undefined }
    }
  }
  return { ok: false, error: 'La retención no existe.' }
}

export async function consultarEmbargos(filtros: ConsultaEmbargosFiltros): Promise<Embargo[]> {
  const tipo = filtros.tipo ?? 'TODAS'
  const texto = (filtros.texto ?? '').trim().toLowerCase()
  const dnis = (filtros.dnis ?? [])
    .map((dni) => dni.replace(/\D/g, ''))
    .filter((dni) => dni.length > 0)
  const hace30Dias = new Date()
  hace30Dias.setDate(hace30Dias.getDate() - 30)
  let lista = mockEmbargos.map(mapEmbargo)
  if (dnis.length > 0) lista = lista.filter((e) => dnis.includes(e.dni.replace(/\D/g, '')))
  if (filtros.estado) lista = lista.filter((e) => e.estado === filtros.estado)
  if (filtros.periodo) {
    lista = lista.filter((e) => {
      const m = mockEmbargos.find((x) => x.id === e.id)
      return !!m && m.retenciones.some((r) => r.periodo === filtros.periodo)
    })
  }
  switch (tipo) {
    case 'AGENTE':
      if (texto) lista = lista.filter((e) => e.dni.includes(texto.replace(/[.\s-]/g, '')))
      break
    case 'PROGRAMA':
      if (texto) lista = lista.filter((e) => e.programa.toLowerCase().includes(texto))
      break
    case 'EXPEDIENTE':
      if (texto) lista = lista.filter((e) => e.expediente.toLowerCase().includes(texto))
      break
    case 'CANCELACIONES':
      lista = lista.filter((e) => e.estado === 'CANCELADO')
      break
    case 'DEVOLUCIONES':
      lista = lista.filter((e) => mockEmbargos.find((m) => m.id === e.id)!.retenciones.some((r) => r.devolucion > 0))
      break
    case 'NO_IMPUTACIONES':
      lista = lista.filter((e) => e.estado === 'ESPERA' && e.cantidadRetenciones === 0)
      break
    case 'ALTAS':
      lista = lista.filter((e) => new Date(e.fechaAlta) >= hace30Dias)
      break
    case 'BAJAS_COBRANDO':
      lista = lista.filter((e) => e.estado === 'BAJA' && e.saldoActual > 0)
      break
    case 'BAJAS_REN_DEC':
      lista = lista.filter((e) => e.estado === 'BAJA' && /renuncia|decreto/i.test(e.motivoBaja))
      if (texto) lista = lista.filter((e) => e.expediente.toLowerCase().includes(texto) || e.autos.toLowerCase().includes(texto) || e.motivoBaja.toLowerCase().includes(texto) || e.agente.toLowerCase().includes(texto))
      break
    case 'ACTIVOS_SIN_RETENCION':
      lista = lista.filter((e) => e.estado === 'ACTIVO' && e.cantidadRetenciones === 0)
      break
    case 'PRIMER_MES':
      if (filtros.periodo) lista = lista.filter((e) => e.primerPeriodo === filtros.periodo)
      break
    default:
      if (texto) lista = lista.filter((e) => e.expediente.toLowerCase().includes(texto) || e.autos.toLowerCase().includes(texto) || e.dni.includes(texto.replace(/[.\s-]/g, '')) || e.agente.toLowerCase().includes(texto))
      break
  }
  // Del más viejo al más nuevo.
  return lista.sort((a, b) => {
    const fa = new Date(a.fechaAlta).getTime() || 0
    const fb = new Date(b.fechaAlta).getTime() || 0
    return fa - fb || a.id - b.id
  })
}

export async function actualizarEsperas(): Promise<{ ok: boolean; error?: string; procesados: number; activados: number; cancelados: number; ajustados: number }> {
  let activados = 0, cancelados = 0, ajustados = 0
  const candidatos = mockEmbargos.filter((m) => m.estado === 'ESPERA' || m.estado === 'ACTIVO')
  for (const m of candidatos) {
    const saldo = roundMoney(m.retenciones.reduce((acc, r) => acc - r.retencionMensual + r.devolucion, m.deuda))
    const ultima = m.retenciones[m.retenciones.length - 1]
    if (ultima && ultima.saldo !== saldo) ajustados++
    if (saldo <= 0) {
      m.estado = 'CANCELADO'
      m.fechaBaja = hoy
      m.motivoBaja = 'Deuda cancelada'
      cancelados++
    } else if (m.estado === 'ESPERA' && m.retenciones.length > 0) {
      m.estado = 'ACTIVO'
      m.fechaBaja = ''
      m.motivoBaja = ''
      activados++
    }
    recalcularSaldosMock(m.id)
  }
  return { ok: true, procesados: candidatos.length, activados, cancelados, ajustados }
}

export async function imputarPeriodo(periodo: string): Promise<{ ok: boolean; error?: string; periodo?: string; creadas: number; omitidas: number; importeTotal: number }> {
  let creadas = 0, omitidas = 0, importeTotal = 0
  const activos = mockEmbargos.filter((m) => m.estado === 'ACTIVO')
  for (const m of activos) {
    if (m.retenciones.some((r) => r.periodo === periodo)) { omitidas++; continue }
    const saldo = roundMoney(m.retenciones.reduce((acc, r) => acc - r.retencionMensual + r.devolucion, m.deuda))
    if (saldo <= 0) { omitidas++; continue }
    const base = m.importeMensual > 0 ? m.importeMensual : m.porcentaje > 0 ? (saldo * m.porcentaje) / 100 : saldo
    const retencion = roundMoney(Math.min(base, saldo))
    if (retencion <= 0) { omitidas++; continue }
    m.retenciones.push({ id: ++nextRetencionId, idEmbargo: m.id, periodo, sueldo: 0, refrigerio: 0, retencionMensual: retencion, saldo: roundMoney(saldo - retencion), devolucion: 0, observaciones: '', fechaRegistro: hoy })
    recalcularSaldosMock(m.id)
    creadas++
    importeTotal = roundMoney(importeTotal + retencion)
  }
  return { ok: true, periodo, creadas, omitidas, importeTotal }
}

export async function generarResumen(periodo: string): Promise<{ ok: boolean; error?: string; filas: ResumenRetencion[] }> {
  const filas: ResumenRetencion[] = []
  for (const m of mockEmbargos) {
    const agente = agenteDe(m.idAgente)
    for (const r of m.retenciones) {
      if (r.periodo !== periodo) continue
      filas.push({
        idRetencion: r.id,
        periodo: r.periodo,
        dni: agente?.dni ?? '',
        agente: agente?.nombreCompleto ?? '',
        autos: m.autos,
        expediente: m.expediente,
        sueldo: r.sueldo,
        refrigerio: r.refrigerio,
        retencionMensual: r.retencionMensual,
        devolucion: r.devolucion,
        saldo: r.saldo,
      })
    }
  }
  filas.sort((a, b) => a.agente.localeCompare(b.agente))
  return { ok: true, filas }
}

export async function exportarResumen(periodo: string): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  const r = await generarResumen(periodo)
  if (!r.ok) return { ok: false, error: r.error }
  const { toCsv } = await import('@/lib/embargos')
  const contenido = toCsv(
    ['PERIODO', 'DNI', 'AGENTE', 'EXPEDIENTE', 'AUTOS', 'SUELDO', 'REFRIGERIO', 'RETENCION', 'DEVOLUCION', 'SALDO'],
    r.filas.map((f) => [periodoLabel(f.periodo), f.dni, f.agente, f.expediente, f.autos, f.sueldo.toFixed(2), f.refrigerio.toFixed(2), f.retencionMensual.toFixed(2), f.devolucion.toFixed(2), f.saldo.toFixed(2)]),
  )
  return { ok: true, contenido, nombre: `resumen-retenciones-${periodo}.csv` }
}

export async function exportarDisquete(periodo: string): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  const r = await exportarResumen(periodo)
  if (!r.ok || !r.contenido) return r
  return { ok: true, contenido: r.contenido, nombre: `disquete-retenciones-${periodo}.txt` }
}

export async function exportarActivos(): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  const { toCsv, periodoActual } = await import('@/lib/embargos')
  const embargos = mockEmbargos.filter((m) => m.estado === 'ACTIVO').map(mapEmbargo)
  const contenido = toCsv(
    ['DNI', 'AGENTE', 'PROGRAMA', 'EXPEDIENTE', 'AUTOS', 'DEUDA', 'IMPORTE_MENSUAL', 'RETENIDO', 'SALDO'],
    embargos.map((e) => [e.dni, e.agente, e.programa, e.expediente, e.autos, e.deuda.toFixed(2), e.importeMensual.toFixed(2), e.totalRetenido.toFixed(2), e.saldoActual.toFixed(2)]),
  )
  return { ok: true, contenido, nombre: `activos-retencion-${periodoActual()}.csv` }
}

export async function exportarBackup(): Promise<{ ok: boolean; error?: string; contenido?: string; nombre?: string }> {
  const { periodoActual } = await import('@/lib/embargos')
  const backup = {
    version: 1,
    generadoEl: new Date().toISOString(),
    embargos: mockEmbargos.map((m) => ({
      dni: agenteDe(m.idAgente)?.dni ?? '',
      agente: agenteDe(m.idAgente)?.nombreCompleto ?? '',
      estado: m.estado,
      autos: m.autos,
      expediente: m.expediente,
      expedienteRetenciones: formatExpedienteRetenciones(m.nroExpedienteRetenciones ?? m.id),
      fechaExpediente: m.fechaExpediente,
      cuenta: m.cuenta,
      sucursal: m.sucursal,
      juez: m.juez,
      instancia: m.instancia,
      nomenclatura: m.nomenclatura,
      tipoProceso: m.tipoProceso,
      secretaria: m.secretaria,
      deuda: m.deuda,
      importeMensual: m.importeMensual,
      porcentaje: m.porcentaje,
      marcaEspecial: m.marcaEspecial,
      observaciones: m.observaciones,
      fechaAlta: m.fechaAlta,
      retenciones: m.retenciones.map((r) => ({
        periodo: r.periodo,
        sueldo: r.sueldo,
        refrigerio: r.refrigerio,
        retencionMensual: r.retencionMensual,
        saldo: r.saldo,
        devolucion: r.devolucion,
        observaciones: r.observaciones,
      })),
    })),
  }
  return { ok: true, contenido: JSON.stringify(backup, null, 2), nombre: `backup-embargos-${periodoActual()}.json` }
}

export async function restaurarBackup(payload: string): Promise<{ ok: boolean; error?: string; creados: number; omitidos: number; errores: string[] }> {
  let parsed: any
  try { parsed = JSON.parse(payload.replace(/^\uFEFF/, '')) } catch { return { ok: false, error: 'El archivo no es un JSON válido.', creados: 0, omitidos: 0, errores: [] } }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== 1 || !Array.isArray(parsed.embargos)) {
    return { ok: false, error: 'Versión de backup no soportada.', creados: 0, omitidos: 0, errores: [] }
  }
  let creados = 0, omitidos = 0
  const errores: string[] = []
  for (const raw of parsed.embargos.slice(0, 1000)) {
    const agente = MOCK_AGENTES.find((a) => a.dni === raw.dni)
    if (!agente) { omitidos++; errores.push(`DNI ${raw.dni}: agente inexistente.`); continue }
    const nuevo: MockEmbargo = {
      id: ++nextEmbargoId,
      idAgente: agente.id,
      dni: agente.dni,
      agente: agente.nombreCompleto,
      estado: (raw.estado as EstadoEmbargo) || 'ESPERA',
      autos: raw.autos ?? '',
      expediente: raw.expediente ?? '',
      fechaExpediente: raw.fechaExpediente ?? '',
      cuenta: raw.cuenta ?? '',
      sucursal: raw.sucursal ?? '',
      juez: raw.juez ?? '',
      instancia: raw.instancia ?? '',
      nomenclatura: raw.nomenclatura ?? '',
      tipoProceso: raw.tipoProceso ?? '',
      secretaria: raw.secretaria ?? '',
      deuda: Number(raw.deuda) || 0,
      importeMensual: Number(raw.importeMensual) || 0,
      porcentaje: Number(raw.porcentaje) || 0,
      marcaEspecial: raw.marcaEspecial ?? '',
      observaciones: raw.observaciones ?? '',
      fechaAlta: raw.fechaAlta ?? hoy,
      fechaBaja: '',
      motivoBaja: '',
      programa: agente.programa,
      secretariaAgente: agente.secretaria,
      cargo: agente.cargo,
      retenciones: [],
    }
    if (Array.isArray(raw.retenciones)) {
      for (const r of raw.retenciones) {
        nuevo.retenciones.push({ id: ++nextRetencionId, idEmbargo: nuevo.id, periodo: r.periodo, sueldo: Number(r.sueldo) || 0, refrigerio: Number(r.refrigerio) || 0, retencionMensual: Number(r.retencionMensual) || 0, saldo: Number(r.saldo) || 0, devolucion: Number(r.devolucion) || 0, observaciones: r.observaciones ?? '', fechaRegistro: hoy })
      }
    }
    recalcularSaldosMock(nuevo.id)
    mockEmbargos.push(nuevo)
    creados++
  }
  return { ok: true, creados, omitidos, errores: errores.slice(0, 20) }
}

export async function verificarIntegridad(): Promise<{ ok: boolean; error?: string; revisados: number; inconsistencias: { idEmbargo: number; dni: string; agente: string; expediente: string; detalle: string }[] }> {
  const inconsistencias: { idEmbargo: number; dni: string; agente: string; expediente: string; detalle: string }[] = []
  for (const m of mockEmbargos) {
    const embargo = mapEmbargo(m)
    const saldoCalculado = roundMoney(m.retenciones.reduce((acc, r) => acc - r.retencionMensual + r.devolucion, m.deuda))
    if (saldoCalculado !== embargo.saldoActual) inconsistencias.push({ idEmbargo: embargo.id, dni: embargo.dni, agente: embargo.agente, expediente: embargo.expediente, detalle: `Saldo registrado ${embargo.saldoActual.toFixed(2)} ≠ saldo calculado ${saldoCalculado.toFixed(2)}.` })
    if (embargo.saldoActual < 0) inconsistencias.push({ idEmbargo: embargo.id, dni: embargo.dni, agente: embargo.agente, expediente: embargo.expediente, detalle: `Saldo negativo (${embargo.saldoActual.toFixed(2)}).` })
    if (embargo.estado === 'ACTIVO' && embargo.cantidadRetenciones === 0) inconsistencias.push({ idEmbargo: embargo.id, dni: embargo.dni, agente: embargo.agente, expediente: embargo.expediente, detalle: 'Embargo activo sin retenciones imputadas.' })
  }
  return { ok: true, revisados: mockEmbargos.length, inconsistencias }
}

export async function reindexarSaldos(): Promise<{ ok: boolean; error?: string; procesados: number }> {
  for (const m of mockEmbargos) recalcularSaldosMock(m.id)
  return { ok: true, procesados: mockEmbargos.length }
}

// ---------- Empleados mock ----------

export function mockBuscarEmpleados(query: string): Empleado[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...MOCK_AGENTES]
  const clean = q.replace(/[.\s-]/g, '')
  if (/^\d+$/.test(clean)) return MOCK_AGENTES.filter((a) => a.dni.includes(clean))
  return MOCK_AGENTES.filter((a) => a.nombreCompleto.toLowerCase().includes(q) || a.apellido.toLowerCase().includes(q))
}

export function mockGetEmpleadoPorId(id: number): Empleado | null {
  return MOCK_AGENTES.find((a) => a.id === id) ?? null
}

export function mockGetUltimoEmpleado(): Empleado | null {
  return MOCK_AGENTES[0] ?? null
}

export function mockActualizarEmpleado(id: number, input: { apellido: string; segundoApellido: string; nombre: string; segundoNombre: string; telefono: string; correo: string; fechaNacimiento: string }): { ok: boolean; error?: string; field?: string; empleado?: Empleado } {
  const agente = MOCK_AGENTES.find((a) => a.id === id)
  if (!agente) return { ok: false, error: 'Empleado no encontrado.' }
  agente.apellido = input.apellido
  agente.segundoApellido = input.segundoApellido
  agente.nombre = input.nombre
  agente.segundoNombre = input.segundoNombre
  agente.nombreCompleto = `${input.apellido}${input.segundoApellido ? ' ' + input.segundoApellido : ''}, ${input.nombre}${input.segundoNombre ? ' ' + input.segundoNombre : ''}`
  agente.telefono = input.telefono
  agente.correo = input.correo
  agente.fechaNacimiento = input.fechaNacimiento
  return { ok: true, empleado: { ...agente } }
}

// ---------- Auth mock ----------

export const MOCK_SESSION = { sessionId: 1, userId: 1, username: 'demo', role: 'ADMIN', mustChangePassword: false }