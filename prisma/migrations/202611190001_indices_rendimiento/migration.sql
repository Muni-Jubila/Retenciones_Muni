-- Índices de rendimiento y garantía de un solo embargo activo por agente.
-- Cambios aditivos; no modifican datos existentes.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent no es IMMUTABLE, por lo que no se puede indexar directamente.
-- Este wrapper permite usar el índice trigram en las búsquedas por nombre.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT extensions.unaccent($1)
$$;

CREATE INDEX IF NOT EXISTS idx_dp_apellido_trgm
  ON "DATOS_PERSONALES_AGENTE_JUBILA"
  USING gin (public.f_unaccent("APELLIDO_AGENTE") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_dp_nombre_trgm
  ON "DATOS_PERSONALES_AGENTE_JUBILA"
  USING gin (public.f_unaccent("NOMBRE_AGENTE") gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_embargo_expediente_trgm
  ON "EMBARGO"
  USING gin ("EXPEDIENTE" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_embargo_fecha_alta
  ON "EMBARGO" ("FECHA_ALTA");

CREATE UNIQUE INDEX IF NOT EXISTS uq_embargo_activo_por_agente
  ON "EMBARGO" ("ID_AGENTE")
  WHERE "BIT_BORRADO" = false AND "ESTADO" = 'ACTIVO';
