-- =====================================================================
-- Migración 0004: amplía animal.motivo_baja a varchar(20).
-- La base remota recibió 0002 antes de este ajuste (versión manual) y
-- la columna quedó en varchar(12), aunque el CHECK ya admite
-- 'SACRIFICIO_SANITARIO' (20 caracteres). Ampliar un varchar no
-- modifica filas ni pierde datos.
-- =====================================================================

BEGIN;

ALTER TABLE animal ALTER COLUMN motivo_baja TYPE varchar(20);

ALTER TABLE animal DROP CONSTRAINT IF EXISTS animal_motivo_baja;
ALTER TABLE animal ADD CONSTRAINT animal_motivo_baja
  CHECK (motivo_baja IS NULL OR motivo_baja IN ('VENTA', 'MUERTE', 'DEVOLUCION', 'SACRIFICIO_SANITARIO'));

COMMIT;
