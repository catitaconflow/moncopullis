-- 0011: importación desde el panel.
-- La 0003 no dejaba la importación en la auditoría y un uuid mal formado o repetido terminaba
-- en un error técnico. Ahora: solo ADMIN (revisado igual que las demás operaciones), validación
-- fila por fila con mensajes claros, todo o nada, y entrada IMPORTAR en la auditoría.
BEGIN;

CREATE OR REPLACE FUNCTION fn_importar_exportacion(p_export_id text, p_registros jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u   bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_imp bigint;
  v_r   jsonb;
  v_n   integer := 0;
  v_ent text;
BEGIN
  IF p_export_id IS NULL OR btrim(p_export_id) = '' THEN PERFORM fn_error('El archivo no tiene export_id.'); END IF;
  IF jsonb_typeof(p_registros) IS DISTINCT FROM 'array' THEN PERFORM fn_error('El archivo no tiene la lista de registros.'); END IF;
  IF jsonb_array_length(p_registros) = 0 THEN PERFORM fn_error('El archivo no trae registros.'); END IF;
  IF jsonb_array_length(p_registros) > 5000 THEN PERFORM fn_error('El archivo trae más de 5.000 registros. Divídelo en partes.'); END IF;
  IF EXISTS (SELECT 1 FROM importacion WHERE export_id = btrim(p_export_id)) THEN
    RETURN jsonb_build_object('estado', 'ya_importado');
  END IF;

  FOR v_r IN SELECT * FROM jsonb_array_elements(p_registros) LOOP
    v_n := v_n + 1;
    v_ent := v_r ->> 'entidad';
    IF v_ent IS NULL OR v_ent NOT IN ('animal', 'medicamento', 'lote', 'tratamiento', 'dosis') THEN
      PERFORM fn_error('Registro ' || v_n || ': la entidad «' || COALESCE(v_ent, '') || '» no se puede importar.');
    END IF;
    IF COALESCE(v_r ->> 'uuid', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      PERFORM fn_error('Registro ' || v_n || ': el uuid no es válido.');
    END IF;
    IF jsonb_typeof(v_r -> 'datos') IS DISTINCT FROM 'object' THEN
      PERFORM fn_error('Registro ' || v_n || ': faltan los datos.');
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT lower(r ->> 'uuid')) FROM jsonb_array_elements(p_registros) r) < v_n THEN
    PERFORM fn_error('El archivo repite uuid: cada registro debe tener uno distinto.');
  END IF;

  INSERT INTO importacion (export_id, usuario_id, cantidad_registros)
  VALUES (btrim(p_export_id), v_u, v_n)
  RETURNING id INTO v_imp;
  INSERT INTO importacion_registro (importacion_id, uuid, entidad, datos)
  SELECT v_imp, (r ->> 'uuid')::uuid, r ->> 'entidad', r -> 'datos' FROM jsonb_array_elements(p_registros) r;

  PERFORM fn_auditar(v_u, 'IMPORTAR', 'importacion', v_imp, 'Importación ' || btrim(p_export_id) || ' con ' || v_n || ' registros');
  RETURN jsonb_build_object('estado', 'importado', 'cantidad', v_n, 'importacion_id', v_imp);
END $$;

REVOKE ALL ON FUNCTION fn_importar_exportacion(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_importar_exportacion(text, jsonb) TO authenticated;

COMMIT;
