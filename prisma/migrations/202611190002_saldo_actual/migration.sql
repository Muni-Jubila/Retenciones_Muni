-- Saldo actual denormalizado en la cabecera del embargo.
-- Se inicializa con el saldo de la última retención o, si no hay retenciones,
-- con la deuda original. El circuito lo mantiene recalcularSaldos().

ALTER TABLE "EMBARGO"
  ADD COLUMN IF NOT EXISTS "SALDO_ACTUAL" DECIMAL(14,2) NOT NULL DEFAULT 0;

UPDATE "EMBARGO" e
SET "SALDO_ACTUAL" = COALESCE(
  (
    SELECT r."SALDO"
    FROM "RETENCION_EMBARGO" r
    WHERE r."ID_EMBARGO" = e."ID_EMBARGO"
    ORDER BY r."PERIODO" DESC
    LIMIT 1
  ),
  e."DEUDA"
);
