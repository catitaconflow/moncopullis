-- =====================================================================
-- Migración 0003: importación de exportaciones, validada e idempotente.
-- Solo ADMIN puede importar. Todo el lote se escribe o nada se escribe.
-- Los registros se guardan tal cual en una tabla de solo inserción;
-- el paso a las tablas de dominio es una migración posterior.
-- =====================================================================

BEGIN;

CREATE TABLE importacion (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  export_id           varchar(100) NOT NULL UNIQUE,
  usuario_id          bigint NOT NULL REFERENCES usuario (id) ON DELETE RESTRICT,
  cantidad_registros  integer NOT NULL,
  fecha               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT importacion_export_valido CHECK (length(btrim(export_id)) > 0),
  CONSTRAINT importacion_cantidad      CHECK (cantidad_registros >= 0)
);

CREATE TABLE importacion_registro (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  importacion_id  bigint NOT NULL REFERENCES importacion (id) ON DELETE RESTRICT,
  uuid            uuid NOT NULL,
  entidad         varchar(20) NOT NULL,
  datos           jsonb NOT NULL,
  CONSTRAINT importacion_registro_uk      UNIQUE (importacion_id, uuid),
  CONSTRAINT importacion_registro_entidad CHECK (entidad IN ('animal', 'medicamento', 'lote', 'tratamiento', 'dosis')),
  CONSTRAINT importacion_registro_datos   CHECK (jsonb_typeof(datos) = 'object')
);

CREATE TRIGGER trg_importacion_inmutable
  BEFORE UPDATE OR DELETE ON importacion
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();
CREATE TRIGGER trg_importacion_registro_inmutable
  BEFORE UPDATE OR DELETE ON importacion_registro
  FOR EACH ROW EXECUTE FUNCTION fn_solo_insercion();

ALTER TABLE importacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE importacion_registro ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_auditoria ON importacion FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'AUDITOR'));
CREATE POLICY lectura_auditoria ON importacion_registro FOR SELECT TO authenticated
  USING (fn_rol_actual() IN ('ADMIN', 'AUDITOR'));

-- Importa un lote. Si cualquier registro es inválido, la función falla y no escribe nada.
CREATE OR REPLACE FUNCTION fn_importar_exportacion(p_export_id text, p_registros jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_usuario bigint;
  v_importacion bigint;
BEGIN
  IF fn_rol_actual() IS DISTINCT FROM 'ADMIN' THEN
    RAISE EXCEPTION 'Solo ADMIN puede importar' USING ERRCODE = '42501';
  END IF;
  IF p_export_id IS NULL OR btrim(p_export_id) = '' THEN
    RAISE EXCEPTION 'export_id obligatorio' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_registros) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'registros debe ser una lista' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM importacion WHERE export_id = p_export_id) THEN
    RETURN jsonb_build_object('estado', 'ya_importado');
  END IF;

  SELECT u.id INTO v_usuario FROM usuario u WHERE u.auth_user_id = auth.uid();
  INSERT INTO importacion (export_id, usuario_id, cantidad_registros)
  VALUES (p_export_id, v_usuario, jsonb_array_length(p_registros))
  RETURNING id INTO v_importacion;

  INSERT INTO importacion_registro (importacion_id, uuid, entidad, datos)
  SELECT v_importacion, (r ->> 'uuid')::uuid, r ->> 'entidad', r -> 'datos'
    FROM jsonb_array_elements(p_registros) AS r;

  RETURN jsonb_build_object('estado', 'importado', 'cantidad', jsonb_array_length(p_registros));
END $$;

COMMIT;
