-- Módulo de Embargos / Retenciones
-- Réplica del circuito legacy "Area Retenciones":
--   · Un embargo por agente (autos, expediente, juzgado, deuda, etc.).
--   · Estado del registro: ESPERA (E), ACTIVO (A), BAJA (B), CANCELADO (C).
--   · Detalle mensual de retenciones con sueldo, refrigerio, retención, saldo
--     pendiente y devoluciones.
--
-- Aplicar manualmente contra la base Supabase (la base ya está gestionada):
--   psql "$DATABASE_URL" -f migration.sql
-- O bien: npx prisma db push

CREATE TABLE IF NOT EXISTS "EMBARGO" (
  "ID_EMBARGO"                  SERIAL           NOT NULL,
  "ID_AGENTE"                   INTEGER          NOT NULL,
  "ESTADO"                      VARCHAR(20)      NOT NULL DEFAULT 'ESPERA',
  "AUTOS"                       VARCHAR(500),
  "EXPEDIENTE"                  VARCHAR(100),
  "FECHA_EXPEDIENTE"            DATE,
  "CUENTA"                      VARCHAR(100),
  "SUCURSAL"                    VARCHAR(50),
  "JUEZ"                        VARCHAR(255),
  "INSTANCIA"                   VARCHAR(50),
  "NOMENCLATURA"                VARCHAR(255),
  "TIPO_PROCESO"                VARCHAR(20),
  "SECRETARIA"                  VARCHAR(100),
  "DEUDA"                       DECIMAL(14, 2)   NOT NULL DEFAULT 0,
  "IMPORTE_MENSUAL"             DECIMAL(14, 2)   NOT NULL DEFAULT 0,
  "PORCENTAJE"                  DECIMAL(5, 2),
  "MARCA_ESPECIAL"              VARCHAR(10),
  "OBSERVACIONES"               VARCHAR(1000),
  "FECHA_ALTA"                  TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "FECHA_BAJA"                  TIMESTAMP(3),
  "MOTIVO_BAJA"                 VARCHAR(255),
  "USUARIO_CREACION"            INTEGER          NOT NULL,
  "FECHA_ULTIMA_MODIFICACION"   TIMESTAMP(3),
  "USUARIO_ULTIMA_MODIFICACION" INTEGER,
  "BIT_BORRADO"                 BOOLEAN          NOT NULL DEFAULT false,
  CONSTRAINT "PK__EMBARGO__ID" PRIMARY KEY ("ID_EMBARGO"),
  CONSTRAINT "fk_EMBARGO_AGENTE" FOREIGN KEY ("ID_AGENTE")
    REFERENCES "DATOS_PERSONALES_AGENTE_JUBILA" ("ID_DATOS_PERSONALES_AGENTE_JUBILA")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE TABLE IF NOT EXISTS "RETENCION_EMBARGO" (
  "ID_RETENCION"       SERIAL         NOT NULL,
  "ID_EMBARGO"         INTEGER        NOT NULL,
  "PERIODO"            VARCHAR(7)     NOT NULL,
  "SUELDO"             DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "REFRIGERIO"         DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "RETENCION_MENSUAL"  DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "SALDO"              DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "DEVOLUCION"         DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "OBSERVACIONES"      VARCHAR(500),
  "FECHA_REGISTRO"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "USUARIO_CREACION"   INTEGER        NOT NULL,
  CONSTRAINT "PK__RETENCION_EMBARGO__ID" PRIMARY KEY ("ID_RETENCION"),
  CONSTRAINT "fk_RETENCION_EMBARGO" FOREIGN KEY ("ID_EMBARGO")
    REFERENCES "EMBARGO" ("ID_EMBARGO")
    ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_embargo_id_agente" ON "EMBARGO" ("ID_AGENTE", "BIT_BORRADO");
CREATE INDEX IF NOT EXISTS "idx_embargo_expediente" ON "EMBARGO" ("EXPEDIENTE");
CREATE INDEX IF NOT EXISTS "idx_embargo_estado" ON "EMBARGO" ("ESTADO", "BIT_BORRADO");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_retencion_embargo_periodo" ON "RETENCION_EMBARGO" ("ID_EMBARGO", "PERIODO");
CREATE INDEX IF NOT EXISTS "idx_retencion_periodo" ON "RETENCION_EMBARGO" ("PERIODO");
