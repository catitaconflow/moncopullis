-- 0015: origen 'APPMOVIL' para las acciones hechas desde la app móvil (Android).
-- Hasta la 0014 la app quedaba como 'WEBAPP'. Desde aquí dosis, movimiento_inventario y auditoria guardan
-- 'APPMOVIL' cuando la acción entra por una función fn_app_*.
--
-- Cómo: igual que el bot (0008/0009), cada fn_app_* que escribe hace al empezar
--   set_config('moncopulli.origen', 'APPMOVIL', true)
-- y fn_origen() lo lee en fn_aplicar_dosis, fn_registrar_ajuste y fn_auditar. El 'true' lo deja hasta el fin
-- de la transacción; por la API cada llamada RPC es su propia transacción, así que no afecta a otras.
-- (No se usa la cláusula SET de la función: Supabase no la permite con un parámetro propio como este.)
--
-- El origen indica por qué función entró la acción; no prueba que venga del teléfono (cualquier usuario
-- autenticado puede llamar a fn_app_* con su sesión) y no da permisos nuevos: los roles los sigue
-- validando fn_exigir_rol dentro de las funciones del panel.
-- El panel y el bot siguen registrando 'WEBAPP' y 'TELEGRAM'.
BEGIN;

-- ---------------------------------------------------------------------
-- 1. Los CHECK de la 0001 aceptan 'APPMOVIL' (8 caracteres: cabe en las columnas varchar(8)).
-- ---------------------------------------------------------------------
ALTER TABLE dosis
  DROP CONSTRAINT dosis_origen,
  ADD CONSTRAINT dosis_origen CHECK (origen IS NULL OR origen IN ('WEBAPP', 'TELEGRAM', 'APPMOVIL'));
ALTER TABLE movimiento_inventario
  DROP CONSTRAINT mov_origen,
  ADD CONSTRAINT mov_origen CHECK (origen IN ('WEBAPP', 'TELEGRAM', 'APPMOVIL'));
ALTER TABLE auditoria
  DROP CONSTRAINT auditoria_origen,
  ADD CONSTRAINT auditoria_origen CHECK (origen IN ('WEBAPP', 'TELEGRAM', 'SISTEMA', 'APPMOVIL'));

-- ---------------------------------------------------------------------
-- 2. fn_origen (0008) reconoce 'APPMOVIL'. Lista cerrada: cualquier otro valor cuenta como 'WEBAPP'.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_origen() RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE current_setting('moncopulli.origen', true)
           WHEN 'TELEGRAM' THEN 'TELEGRAM'
           WHEN 'APPMOVIL' THEN 'APPMOVIL'
           ELSE 'WEBAPP'
         END;
$$;
REVOKE ALL ON FUNCTION fn_origen() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. fn_registrar_ajuste (0005) toma el origen de fn_origen() en vez de 'WEBAPP' fijo.
--    Copia exacta de la 0005 con ese único cambio; para el panel todo sigue igual.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_ajuste(p_lote_id bigint, p_tipo text, p_cantidad numeric, p_motivo text,
                                               p_observaciones text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_lote lote;
  v_mov  bigint;
BEGIN
  SELECT * INTO v_lote FROM lote WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('El lote no existe.'); END IF;
  IF p_tipo NOT IN ('SALIDA_AJUSTE', 'ENTRADA_AJUSTE') THEN PERFORM fn_error('El ajuste debe ser de salida o de entrada.'); END IF;
  IF p_motivo NOT IN ('VENCIDO', 'ROTO_DERRAME', 'CONTEO', 'OTRO') THEN PERFORM fn_error('Elige un motivo de ajuste válido.'); END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN PERFORM fn_error('La cantidad debe ser mayor que 0.'); END IF;
  IF p_motivo = 'OTRO' AND NULLIF(btrim(p_observaciones), '') IS NULL THEN
    PERFORM fn_error('Con el motivo «Otro» debes explicar el ajuste en observaciones.');
  END IF;
  IF p_tipo = 'SALIDA_AJUSTE' AND p_cantidad > v_lote.stock_lote THEN
    PERFORM fn_error('Stock insuficiente: el lote ' || v_lote.numero_lote || ' tiene ' || v_lote.stock_lote || '.');
  END IF;

  INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, motivo, observaciones,
                                     usuario_id, origen, fecha_evento)
  VALUES (gen_random_uuid(), v_lote.medicamento_id, v_lote.id, p_tipo, p_cantidad, p_motivo,
          left(NULLIF(btrim(p_observaciones), ''), 300), v_u, fn_origen(), now())
  RETURNING id INTO v_mov;
  PERFORM fn_auditar(v_u, 'CREAR', 'movimiento_inventario', v_mov,
                     CASE p_tipo WHEN 'SALIDA_AJUSTE' THEN 'Ajuste de salida de ' ELSE 'Ajuste de entrada de ' END
                     || p_cantidad || ' en lote ' || v_lote.numero_lote || ' (' || p_motivo || ')');
  PERFORM fn_generar_alertas();
  RETURN v_mov;
END $$;

-- ---------------------------------------------------------------------
-- 4. Funciones de la 0014: copia exacta, más la línea marcada "-- 0015" al inicio del cuerpo.
--    Los permisos de la 0014 se conservan (CREATE OR REPLACE no los cambia).
-- ---------------------------------------------------------------------
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
  PERFORM set_config('moncopulli.origen', 'APPMOVIL', true); -- 0015
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
  PERFORM set_config('moncopulli.origen', 'APPMOVIL', true); -- 0015
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

-- ---------------------------------------------------------------------
-- 5. Nuevas funciones de la app (solo con conexión: NO son idempotentes, igual que las del panel).
--    Solo fijan el origen y llaman a la función del panel: mismas validaciones, permisos y auditoría.
-- ---------------------------------------------------------------------
-- Omite una dosis PROGRAMADA (fn_omitir_dosis, 0005).
CREATE OR REPLACE FUNCTION fn_app_omitir_dosis(p_dosis_id bigint, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('moncopulli.origen', 'APPMOVIL', true);
  PERFORM fn_omitir_dosis(p_dosis_id, p_motivo);
END $$;

-- Salida por ajuste (merma) de un lote: siempre SALIDA_AJUSTE; la app no hace ajustes de entrada.
-- Devuelve el id del movimiento. p_observaciones es opcional (obligatoria solo con el motivo OTRO).
CREATE OR REPLACE FUNCTION fn_app_registrar_salida(p_lote_id bigint, p_cantidad numeric, p_motivo text,
                                                   p_observaciones text DEFAULT NULL) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('moncopulli.origen', 'APPMOVIL', true);
  RETURN fn_registrar_ajuste(p_lote_id, 'SALIDA_AJUSTE', p_cantidad, p_motivo, p_observaciones);
END $$;

-- Permisos: igual que la 0014 (solo usuarios autenticados).
REVOKE ALL ON FUNCTION fn_app_omitir_dosis(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_app_omitir_dosis(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION fn_app_registrar_salida(bigint, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_app_registrar_salida(bigint, numeric, text, text) TO authenticated;

COMMIT;
