-- 0014: funciones de la app móvil (Android).
-- La app no escribe en las tablas: llama a estas funciones con la sesión del usuario (rol authenticated).
-- Aditiva: solo crea funciones; no cambia tablas ni datos.
--   fn_app_registrar_aplicacion: registro en terreno (tratamiento + dosis aplicada), idempotente por p_uuid.
--   fn_app_aplicar_dosis: aplica una dosis programada; el lote se elige por FEFO. Idempotente si la aplicó el mismo usuario.
-- Las dos terminan llamando a fn_aplicar_dosis (0008): stock, resguardo de leche, auditoría y alertas salen del
-- mismo camino que el panel. El origen queda 'WEBAPP' (fn_origen) porque los CHECK de dosis,
-- movimiento_inventario y auditoria no admiten 'ANDROID'; la auditoría del tratamiento dice "app móvil".
-- Respuesta: jsonb {estado: 'creado' | 'ya_registrado', dosis_id, lote, resguardo_hasta [, tratamiento_id]}.
-- Errores: P0001 = mensaje para el usuario; 42501 = sin permiso.
BEGIN;

-- Utilidad interna (no se expone por la API): resumen de una dosis para la respuesta.
CREATE OR REPLACE FUNCTION fn_app_resumen_dosis(p_estado text, p_dosis_id bigint) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object('estado', p_estado, 'dosis_id', d.id, 'lote', l.numero_lote,
                            'resguardo_hasta', d.fin_resguardo_leche)
    FROM dosis d LEFT JOIN lote l ON l.id = d.lote_id
   WHERE d.id = p_dosis_id
$$;

-- Registro en terreno. p_uuid lo genera la app al guardar y es el uuid del tratamiento: repetir la
-- llamada (reintento tras perder la conexión) devuelve 'ya_registrado' sin tocar el stock.
-- Los parámetros opcionales van al final y con DEFAULT NULL: la app los llama por nombre.
CREATE OR REPLACE FUNCTION fn_app_registrar_aplicacion(
  p_uuid uuid, p_diio text, p_medicamento_id bigint, p_cantidad numeric, p_indicado_por text,
  p_fecha_aplicada timestamptz DEFAULT NULL, p_motivo text DEFAULT NULL, p_observaciones text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u     bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_diio  text := btrim(p_diio);
  v_ind   text := NULLIF(btrim(p_indicado_por), '');
  v_mot   text := NULLIF(btrim(p_motivo), '');
  v_obs   text := NULLIF(btrim(p_observaciones), '');
  v_cant  numeric := round(p_cantidad, 2);
  v_fecha timestamptz := COALESCE(p_fecha_aplicada, now());
  v_prev  tratamiento;
  v_a     animal;
  v_m     medicamento;
  v_l     lote;
  v_t     bigint;
  v_dosis bigint;
BEGIN
  IF p_uuid IS NULL THEN PERFORM fn_error('Falta el identificador del registro.'); END IF;

  -- Idempotencia: dos llamadas con el mismo p_uuid no corren a la vez, y la segunda ve lo de la primera.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_uuid::text, 0));
  SELECT * INTO v_prev FROM tratamiento WHERE uuid = p_uuid;
  IF FOUND THEN
    IF v_prev.creado_por <> v_u THEN PERFORM fn_error('Ese registro pertenece a otro usuario.'); END IF;
    SELECT id INTO v_dosis FROM dosis WHERE tratamiento_id = v_prev.id ORDER BY id LIMIT 1;
    RETURN jsonb_build_object('tratamiento_id', v_prev.id) || fn_app_resumen_dosis('ya_registrado', v_dosis);
  END IF;

  IF v_diio IS NULL OR v_diio !~ '^[0-9]{9}$' THEN PERFORM fn_error('El DIIO debe tener 9 dígitos.'); END IF;
  SELECT * INTO v_a FROM animal WHERE diio = v_diio;
  IF NOT FOUND THEN PERFORM fn_error('No existe un animal con DIIO ' || v_diio || '.'); END IF;
  IF v_a.fecha_baja IS NOT NULL THEN PERFORM fn_error('El animal ' || v_diio || ' está dado de baja.'); END IF;
  IF v_ind IS NULL THEN PERFORM fn_error('Indica quién prescribe el tratamiento.'); END IF;
  IF length(v_ind) > 120 THEN PERFORM fn_error('Quien prescribe admite hasta 120 caracteres.'); END IF;
  IF length(v_mot) > 200 THEN PERFORM fn_error('El motivo admite hasta 200 caracteres.'); END IF;
  IF v_cant IS NULL OR v_cant <= 0 THEN PERFORM fn_error('La cantidad debe ser mayor que 0.'); END IF;
  IF v_cant > 99999999.99 THEN PERFORM fn_error('La cantidad es demasiado grande.'); END IF;
  IF v_fecha > now() + interval '5 minutes' THEN PERFORM fn_error('La fecha de aplicación no puede ser futura.'); END IF;

  SELECT * INTO v_m FROM medicamento WHERE id = p_medicamento_id AND activo;
  IF NOT FOUND THEN PERFORM fn_error('El medicamento no existe o está inactivo.'); END IF;

  -- FEFO: el lote vigente que vence antes y alcanza para la dosis (vigente hoy y en la fecha de aplicación).
  SELECT * INTO v_l FROM lote
   WHERE medicamento_id = v_m.id AND activo AND stock_lote >= v_cant
     AND fecha_vencimiento >= GREATEST(current_date, v_fecha::date)
   ORDER BY fecha_vencimiento, id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM fn_error('Stock insuficiente: ningún lote vigente de ' || v_m.nombre_comercial || ' tiene ' || v_cant || ' ' || v_m.unidad_base || '.');
  END IF;

  INSERT INTO tratamiento (uuid, animal_id, indicado_por, motivo, observaciones, creado_por)
  VALUES (p_uuid, v_a.id, v_ind, v_mot, v_obs, v_u)
  RETURNING id INTO v_t;
  INSERT INTO dosis (uuid, tratamiento_id, medicamento_id, cantidad, estado, fecha_programada)
  VALUES (gen_random_uuid(), v_t, v_m.id, v_cant, 'PROGRAMADA', v_fecha)
  RETURNING id INTO v_dosis;
  PERFORM fn_auditar(v_u, 'CREAR', 'tratamiento', v_t,
                     'Registro en terreno desde la app móvil: ' || v_m.nombre_comercial || ' a DIIO ' || v_diio);
  PERFORM fn_aplicar_dosis(v_dosis, v_l.id, v_fecha);

  RETURN jsonb_build_object('tratamiento_id', v_t) || fn_app_resumen_dosis('creado', v_dosis);
END $$;

-- Aplica una dosis programada. Si ya la aplicó este mismo usuario (por ejemplo, un reintento) responde
-- 'ya_registrado'; si la aplicó otro, o ya no está PROGRAMADA, responde con un mensaje claro.
CREATE OR REPLACE FUNCTION fn_app_aplicar_dosis(p_dosis_id bigint, p_fecha_aplicada timestamptz DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u     bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_fecha timestamptz := COALESCE(p_fecha_aplicada, now());
  v_d     dosis;
  v_m     medicamento;
  v_l     lote;
BEGIN
  SELECT * INTO v_d FROM dosis WHERE id = p_dosis_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('La dosis no existe.'); END IF;
  IF v_d.estado = 'APLICADA' THEN
    IF v_d.aplicado_por = v_u THEN RETURN fn_app_resumen_dosis('ya_registrado', v_d.id); END IF;
    PERFORM fn_error('Esta dosis ya fue aplicada por otro usuario.');
  END IF;
  IF v_d.estado <> 'PROGRAMADA' THEN PERFORM fn_error('Solo se puede aplicar una dosis programada.'); END IF;
  IF v_fecha > now() + interval '5 minutes' THEN PERFORM fn_error('La fecha de aplicación no puede ser futura.'); END IF;

  SELECT * INTO v_m FROM medicamento WHERE id = v_d.medicamento_id;
  SELECT * INTO v_l FROM lote
   WHERE medicamento_id = v_d.medicamento_id AND activo AND stock_lote >= v_d.cantidad
     AND fecha_vencimiento >= GREATEST(current_date, v_fecha::date)
   ORDER BY fecha_vencimiento, id LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM fn_error('Stock insuficiente: ningún lote vigente de ' || v_m.nombre_comercial || ' tiene ' || v_d.cantidad || ' ' || v_m.unidad_base || '.');
  END IF;

  PERFORM fn_aplicar_dosis(v_d.id, v_l.id, v_fecha);
  RETURN fn_app_resumen_dosis('creado', v_d.id);
END $$;

-- Permisos: solo usuarios autenticados. La utilidad interna no se expone por la API.
REVOKE ALL ON FUNCTION fn_app_resumen_dosis(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_app_registrar_aplicacion(uuid, text, bigint, numeric, text, timestamptz, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_app_registrar_aplicacion(uuid, text, bigint, numeric, text, timestamptz, text, text) TO authenticated;
REVOKE ALL ON FUNCTION fn_app_aplicar_dosis(bigint, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_app_aplicar_dosis(bigint, timestamptz) TO authenticated;

COMMIT;