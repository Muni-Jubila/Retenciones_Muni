-- Correlativo interno de retenciones (formato 000.000/000).
-- Las filas existentes reciben un valor automáticamente; los nuevos embargos
-- toman el siguiente número de la secuencia.
ALTER TABLE "EMBARGO" ADD COLUMN "NRO_EXPEDIENTE_RETENCIONES" SERIAL NOT NULL;

CREATE UNIQUE INDEX "EMBARGO_NRO_EXPEDIENTE_RETENCIONES_key" ON "EMBARGO"("NRO_EXPEDIENTE_RETENCIONES");
