-- =====================================================================
-- Migración 0002: trazabilidad SAG de animales y documentos veterinarios.
-- Aditiva: no borra datos ni cambia el stock. Se ejecuta después de 0001.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Animal: linaje materno, origen del ingreso y motivo de baja SAG
-- ---------------------------------------------------------------------
ALTER TABLE animal
  ADD COLUMN madre_id bigint REFERENCES animal (id) ON DELETE RESTRICT,
  ADD COLUMN origen_ingreso varchar(20) NOT NULL DEFAULT 'NACIDO_EN_PREDIO',
  ADD CONSTRAINT animal_madre_no_propia CHECK (madre_id IS NULL OR madre_id <> id),
  ADD CONSTRAINT animal_origen_ingreso CHECK (origen_ingreso IN ('NACIDO_EN_PREDIO', 'COMPRA', 'PRESTAMO_RECIBIDO'));

-- Se amplía el motivo de baja con sacrificio sanitario (exigido en la trazabilidad).
-- La columna era varchar(12); 'SACRIFICIO_SANITARIO' tiene 20 caracteres.
ALTER TABLE animal ALTER COLUMN motivo_baja TYPE varchar(20);
ALTER TABLE animal DROP CONSTRAINT animal_motivo_baja;
ALTER TABLE animal ADD CONSTRAINT animal_motivo_baja
  CHECK (motivo_baja IS NULL OR motivo_baja IN ('VENTA', 'MUERTE', 'DEVOLUCION', 'SACRIFICIO_SANITARIO'));

-- ---------------------------------------------------------------------
-- 2. Documentos veterinarios (PDF, imágenes, planillas) guardados en Storage
-- Solo se guarda la ruta del archivo; el contenido vive en el bucket privado.
-- ---------------------------------------------------------------------
CREATE TABLE documento_veterinario (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  uuid                 uuid NOT NULL UNIQUE,
  animal_id            bigint REFERENCES animal (id) ON DELETE RESTRICT,
  tratamiento_id       bigint REFERENCES tratamiento (id) ON DELETE RESTRICT,
  usuario_id           bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  ruta_almacenamiento  text NOT NULL UNIQUE,
  nombre_original      varchar(255) NOT NULL,
  tipo                 varchar(10) NOT NULL,
  origen               varchar(10) NOT NULL,
  fecha_subida         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT documento_asociado     CHECK (animal_id IS NOT NULL OR tratamiento_id IS NOT NULL),
  CONSTRAINT documento_ruta_valida  CHECK (length(trim(ruta_almacenamiento)) > 0),
  CONSTRAINT documento_tipo         CHECK (tipo IN ('PDF', 'IMAGEN', 'EXCEL', 'WORD')),
  CONSTRAINT documento_origen       CHECK (origen IN ('BOT', 'PANEL'))
);
CREATE INDEX documento_animal_idx      ON documento_veterinario (animal_id);
CREATE INDEX documento_tratamiento_idx ON documento_veterinario (tratamiento_id);

-- Solo inserción, igual que el historial de inventario y la auditoría.
CREATE TRIGGER trg_documento_inmutable
  BEFORE UPDATE OR DELETE ON documento_veterinario
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

ALTER TABLE documento_veterinario ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_operacion ON documento_veterinario FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'OPERARIO', 'AUDITOR'));

COMMIT;
