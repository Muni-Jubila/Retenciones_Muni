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
  - Lista de embargos con la marca legacy **E / A / B / C** (espera, activo, baja, cancelado).
  - Alta y modificación del embargo completo en la misma pantalla: autos, expediente, fecha, cuenta, juez, instancia, nomenclatura, tipo, secretaría judicial, deuda, retención mensual, porcentaje, marca especial, estado y observaciones.
  - Detalle mensual de retenciones con las columnas del sistema viejo: **Mes Ret., Refrig., Sueldo, R. Mensual, Saldo y Dev.**
  - Alta, modificación y eliminación de retenciones con recálculo automático de saldos.
  - Cambio rápido de estado con captura del motivo de baja/cancelación (alimenta la consulta “Bajas x Ren./Dec.”) e impresión de la ficha.

- **Consultas**
  - Todas, por agente, por programa, por expediente, cancelaciones, devoluciones, no imputaciones, altas, bajas cobrando, bajas por renuncia/decreto, activos sin retención y primer mes de retención.
  - Filtros por estado y período.
  - Acceso directo a la ficha del agente desde cada resultado.

- **Actualizar**
  - Actualizar esperas y saldos.
  - Imputar sueldo / refrigerio por período.
  - Emisión de resumen con previsualización y descarga CSV.
  - Generación de archivo de liquidación (reemplazo del “disquete”).
  - Archivo de agentes activos con retención.
  - Activación de esperas previas al sueldo.
  - Eliminación de registros por expediente.

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

### Vista previa del frontend sin base de datos

Para recorrer las pantallas del módulo de Embargos sin tener aplicada la migración
ni conexión a la base, creá un archivo `.env.local` (ignorado por git) con:

```bash
EMBARGOS_MOCK=1
```

En ese modo el sistema usa datos de ejemplo en memoria (2 agentes, 4 embargos con los
4 estados y retenciones mensuales) y todas las acciones (alta, modificación, cambio de
estado, imputación, consultas, backup/restauración, verificación de integridad) se
ejecutan sobre esos datos. Para volver al modo real, eliminá `.env.local` o poné
`EMBARGOS_MOCK=0`. Por defecto el modo mock está desactivado.
