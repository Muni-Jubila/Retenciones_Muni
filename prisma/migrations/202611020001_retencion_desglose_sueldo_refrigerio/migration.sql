-- Desglose de la retención mensual: cuánto se retuvo del sueldo y del
-- refrigerio, y el salario mínimo vital y móvil usado para calcularla.
-- Las retenciones anteriores quedan en 0 y la pantalla muestra el desglose
-- proporcional calculado a partir del sueldo/refrigerio registrados.
ALTER TABLE "RETENCION_EMBARGO" ADD COLUMN "RETENCION_SUELDO" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RETENCION_EMBARGO" ADD COLUMN "RETENCION_REFRIGERIO" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "RETENCION_EMBARGO" ADD COLUMN "SALARIO_MINIMO" DECIMAL(14,2) NOT NULL DEFAULT 398800;
