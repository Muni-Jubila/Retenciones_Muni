# Retenciones_Muni

Sistema web del **Área Retenciones — Subsecretaría de Capital Humano**. Mantiene la ficha de datos personales de los agentes y suma el módulo de **Embargos / Retenciones**, que replica el circuito del sistema legacy (FoxPro) en una sola pantalla.

## Módulos

### Inicio
Ficha de datos personales del agente: búsqueda por DNI o apellido, datos de contacto, programa, secretaría, cargo, antigüedades y edición controlada.

### Embargos
Nuevo módulo con cuatro pestañas internas, sin saltos de página:

- **Ficha del agente**
  - Buscador de agentes por DNI, apellido o nombre.
  - Datos del agente y resumen de embargos (activos, en espera, deuda, retenido y saldo).
  - Lista de embargos con la marca legacy **E / A / N / B / C** (espera, activo, no imputación, baja, cancelado).
  - Alta y modificación del embargo completo en la misma pantalla: autos, expediente, fecha, cuenta, juez, instancia, nomenclatura, tipo, secretaría judicial, deuda, retención mensual, porcentaje, marca especial, estado y observaciones.
  - Detalle mensual de retenciones con **Retención Sueldo**, **Retención Refrigerio**, retención total y saldo.
  - Alta, modificación y eliminación de retenciones con carga manual de importes y recálculo automático de saldos.
  - Cambio rápido de estado con captura del motivo de baja/cancelación (alimenta la consulta “Bajas x Ren./Dec.”) e impresión de la ficha.

- **Consultas**
  - Todas, por agente, por programa, por expediente, cancelaciones, devoluciones, no imputaciones, altas, bajas cobrando, bajas por renuncia/decreto, activos sin retención y primer mes de retención.
  - Filtros por estado y período.
  - Acceso directo a la ficha del agente desde cada resultado.

- **Actualizar**
  - Importar la planilla de liquidación en Excel: filtra los procesos de Sueldo y Refrigerio REM con código 8500 (Embargos Varios), muestra la vista previa y crea o actualiza las retenciones del período. La planilla se sube en fragmentos, así que no tiene el límite de 4,5 MB de Vercel.
  - Carga masiva de oficios judiciales en PDF: procesa varios archivos, muestra una pestaña por oficio con el PDF y los datos detectados, permite editarlos y marca en verde los revisados para crear los embargos en lote. Los PDF también se suben en fragmentos.
  - Interfaz VISMA en Excel: exporta el saldo pendiente actual de los embargos activos (deuda menos todas las retenciones ya registradas) con el formato que se envía a VISMA para liquidar los sueldos. El mes a liquidar define la fecha del archivo (día 1) y su nombre.

- **Informes**
  - Saldos en curso por mes: embargos vigentes, deuda, retenido y saldo al cierre de cada mes, con detalle por embargo y descarga CSV.
  - Actualizar esperas y saldos.
  - Imputar sueldo / refrigerio por período.
  - Emisión de resumen con previsualización y descarga CSV.
  - Generación de archivo de liquidación (reemplazo del “disquete”).
  - Archivo de agentes activos con retención.
  - Activación de esperas previas al sueldo.

- **Archivos**
  - Indexar / recalcular saldos.
  - Restaurar un backup JSON generado por el sistema.
  - Backup completo de embargos y retenciones.
  - Verificación de integridad (saldos inconsistentes, negativos o activos sin retención).

## Base de datos

El módulo agrega dos tablas:

- `EMBARGO`: cabecera del embargo por agente.
- `RETENCION_EMBARGO`: detalle mensual, único por embargo y período.

La migración está en:

```text
prisma/migrations/202610220001_embargos_retenciones/migration.sql
```

Aplicarla contra la base configurada en `DATABASE_URL`:

```bash
psql "$DATABASE_URL" -f prisma/migrations/202610220001_embargos_retenciones/migration.sql
```

o, si se prefiere sincronizar el esquema desde Prisma:

```bash
npx prisma db push
```

Luego regenerar el cliente:

```bash
npx prisma generate
```

## Desarrollo

```bash
npm install
npm run dev
```

Variables de entorno necesarias: `DATABASE_URL` y `SESSION_SECRET` (ver `.env.example`).
