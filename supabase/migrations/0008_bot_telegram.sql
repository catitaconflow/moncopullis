-- 0008: bot de Telegram.
-- El origen de auditoría, dosis y movimientos deja de estar fijo en WEBAPP: lo toma de la variable
-- de sesión moncopulli.origen, que solo fijan las funciones del bot (el panel no puede cambiarla).
BEGIN;

CREATE OR REPLACE FUNCTION fn_origen() RETURNS text
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT CASE WHEN current_setting('moncopulli.origen', true) = 'TELEGRAM' THEN 'TELEGRAM' ELSE 'WEBAPP' END;
$$;
REVOKE ALL ON FUNCTION fn_origen() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION fn_auditar(p_usuario bigint, p_accion text, p_entidad text, p_entidad_id bigint,
                                      p_descripcion text, p_cambios jsonb DEFAULT '{}'::jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aud bigint;
BEGIN
  INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, origen, descripcion)
  VALUES (p_usuario, p_accion, p_entidad, p_entidad_id, fn_origen(), left(p_descripcion, 300))
  RETURNING id INTO v_aud;

  INSERT INTO auditoria_detalle (auditoria_id, campo, valor_anterior, valor_nuevo)
  SELECT v_aud, c.key, c.value ->> 0, c.value ->> 1
    FROM jsonb_each(p_cambios) AS c
   WHERE (c.value ->> 0) IS DISTINCT FROM (c.value ->> 1);
END $$;

CREATE OR REPLACE FUNCTION fn_aplicar_dosis(p_dosis_id bigint, p_lote_id bigint, p_fecha_aplicada timestamptz) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u    bigint := fn_exigir_rol(ARRAY['ADMIN', 'OPERARIO']);
  v_d    dosis;
  v_l    lote;
  v_t    tratamiento;
  v_resg smallint;
  v_mov  bigint;
  v_fecha timestamptz := COALESCE(p_fecha_aplicada, now());
BEGIN
  SELECT * INTO v_d FROM dosis WHERE id = p_dosis_id FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('La dosis no existe.'); END IF;
  IF v_d.estado <> 'PROGRAMADA' THEN PERFORM fn_error('Solo se puede aplicar una dosis programada.'); END IF;
  SELECT * INTO v_t FROM tratamiento WHERE id = v_d.tratamiento_id;
  IF v_t.fecha_anulacion IS NOT NULL THEN PERFORM fn_error('El tratamiento está anulado.'); END IF;
  IF v_fecha > now() + interval '5 minutes' THEN PERFORM fn_error('La fecha de aplicación no puede ser futura.'); END IF;

  SELECT * INTO v_l FROM lote WHERE id = p_lote_id FOR UPDATE;
  IF NOT FOUND OR v_l.medicamento_id <> v_d.medicamento_id THEN PERFORM fn_error('Elige un lote del medicamento indicado.'); END IF;
  IF NOT v_l.activo THEN PERFORM fn_error('El lote está inactivo.'); END IF;
  IF v_l.fecha_vencimiento < v_fecha::date THEN PERFORM fn_error('El lote ' || v_l.numero_lote || ' está vencido.'); END IF;
  IF v_l.stock_lote < v_d.cantidad THEN
    PERFORM fn_error('Stock insuficiente: el lote ' || v_l.numero_lote || ' tiene ' || v_l.stock_lote || ' y la dosis requiere ' || v_d.cantidad || '.');
  END IF;

  SELECT resguardo_leche_dias INTO v_resg FROM medicamento WHERE id = v_d.medicamento_id;
  UPDATE dosis SET estado = 'APLICADA', lote_id = v_l.id, fecha_aplicada = v_fecha, aplicado_por = v_u, origen = fn_origen(),
         fin_resguardo_leche = CASE WHEN v_resg > 0 THEN v_fecha + make_interval(days => v_resg) END
   WHERE id = p_dosis_id;
  INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
  VALUES (gen_random_uuid(), v_d.medicamento_id, v_l.id, 'SALIDA_DOSIS', v_d.cantidad, v_d.id, v_u, fn_origen(), v_fecha)
  RETURNING id INTO v_mov;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'dosis', p_dosis_id, 'Dosis aplicada con lote ' || v_l.numero_lote,
                     jsonb_build_object('estado', jsonb_build_array('PROGRAMADA', 'APLICADA'),
                                        'lote_id', jsonb_build_array(NULL, v_l.id)));
  PERFORM fn_generar_alertas();
END $$;

-- ---------------------------------------------------------------------
-- Bot de Telegram
-- El Worker llama a estas funciones con la clave anon y una clave propia del bot.
-- La tabla bot_clave guarda solo el SHA-256 de esa clave; el valor vive en los secretos del Worker.
-- ---------------------------------------------------------------------
CREATE TABLE bot_clave (
  id   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hash bytea NOT NULL
);
ALTER TABLE bot_clave ENABLE ROW LEVEL SECURITY; -- sin políticas: nadie la lee desde la API

CREATE OR REPLACE FUNCTION fn_bot_validar(p_clave text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_clave IS NULL OR NOT EXISTS (SELECT 1 FROM bot_clave WHERE hash = sha256(convert_to(p_clave, 'UTF8'))) THEN
    RAISE EXCEPTION 'Clave del bot inválida.' USING ERRCODE = '42501';
  END IF;
END $$;

-- Usuario activo vinculado a ese telegram_user_id, o error con el mensaje para el chat.
CREATE OR REPLACE FUNCTION fn_bot_usuario_vinculado(p_tg bigint) RETURNS usuario
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v usuario;
BEGIN
  SELECT * INTO v FROM usuario WHERE telegram_user_id = p_tg AND activo;
  IF NOT FOUND THEN
    PERFORM fn_error('Tu cuenta de Telegram no está vinculada. Pide un código al administrador y envía /vincular correo código.');
  END IF;
  RETURN v;
END $$;

-- Ejecuta lo que sigue en la transacción como ese usuario y con origen TELEGRAM.
CREATE OR REPLACE FUNCTION fn_bot_actuar_como(p_u usuario) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_u.auth_user_id, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_u.auth_user_id::text, true);
  PERFORM set_config('moncopulli.origen', 'TELEGRAM', true);
END $$;

-- Primer lote vigente con stock suficiente, el que vence antes (FEFO).
CREATE OR REPLACE FUNCTION fn_bot_lote_fefo(p_medicamento bigint, p_cantidad numeric) RETURNS lote
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM lote
   WHERE medicamento_id = p_medicamento AND activo AND fecha_vencimiento >= current_date AND stock_lote >= p_cantidad
   ORDER BY fecha_vencimiento, id LIMIT 1;
$$;

-- ADMIN genera un código de 6 dígitos para que el usuario vincule su Telegram (10 minutos, 3 intentos).
CREATE OR REPLACE FUNCTION fn_generar_codigo_telegram(p_usuario_id bigint) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u      bigint := fn_exigir_rol(ARRAY['ADMIN']);
  v_codigo text := lpad((floor(random() * 1000000))::int::text, 6, '0');
  v_dest   usuario;
BEGIN
  SELECT * INTO v_dest FROM usuario WHERE id = p_usuario_id;
  IF NOT FOUND OR NOT v_dest.activo THEN PERFORM fn_error('El usuario no existe o está inactivo.'); END IF;
  IF v_dest.rol NOT IN ('ADMIN', 'OPERARIO') THEN PERFORM fn_error('Solo ADMIN y OPERARIO usan el bot.'); END IF;
  UPDATE usuario SET telegram_codigo_hash = encode(sha256(convert_to(v_codigo, 'UTF8')), 'hex'),
                     telegram_codigo_expira = now() + interval '10 minutes', telegram_codigo_intentos = 0
   WHERE id = p_usuario_id;
  PERFORM fn_auditar(v_u, 'MODIFICAR', 'usuario', p_usuario_id, 'Código de vinculación de Telegram generado para ' || v_dest.email);
  RETURN v_codigo;
END $$;

CREATE OR REPLACE FUNCTION fn_bot_vincular(p_clave text, p_tg bigint, p_correo text, p_codigo text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v usuario;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM set_config('moncopulli.origen', 'TELEGRAM', true);
  IF EXISTS (SELECT 1 FROM usuario WHERE telegram_user_id = p_tg) THEN
    PERFORM fn_error('Esta cuenta de Telegram ya está vinculada.');
  END IF;
  SELECT * INTO v FROM usuario WHERE lower(email) = lower(btrim(p_correo)) AND activo FOR UPDATE;
  IF NOT FOUND OR v.telegram_codigo_hash IS NULL OR v.telegram_codigo_expira < now() OR v.telegram_codigo_intentos >= 3 THEN
    PERFORM fn_error('Código inválido o vencido. Pide uno nuevo al administrador.');
  END IF;
  IF v.telegram_codigo_hash <> encode(sha256(convert_to(btrim(p_codigo), 'UTF8')), 'hex') THEN
    UPDATE usuario SET telegram_codigo_intentos = telegram_codigo_intentos + 1 WHERE id = v.id;
    RETURN 'Código incorrecto. Te quedan ' || (2 - v.telegram_codigo_intentos) || ' intentos.';
  END IF;
  UPDATE usuario SET telegram_user_id = p_tg, telegram_codigo_hash = NULL, telegram_codigo_expira = NULL,
                     telegram_codigo_intentos = 0
   WHERE id = v.id;
  PERFORM fn_auditar(v.id, 'MODIFICAR', 'usuario', v.id, 'Cuenta vinculada a Telegram',
                     jsonb_build_object('telegram_user_id', jsonb_build_array(NULL, p_tg)));
  RETURN 'Listo, ' || v.nombres || '. Tu cuenta quedó vinculada.';
END $$;

-- Medicamentos bajo el mínimo.
CREATE OR REPLACE FUNCTION fn_bot_stock(p_clave text, p_tg bigint) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM fn_bot_usuario_vinculado(p_tg);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('nombre', nombre_comercial, 'stock', stock_actual, 'minimo', stock_minimo,
                                                       'unidad', unidad_base) ORDER BY nombre_comercial)
                     FROM medicamento WHERE activo AND stock_actual < stock_minimo), '[]'::jsonb);
END $$;

-- Datos del animal, resguardo de leche vigente y últimas dosis aplicadas.
CREATE OR REPLACE FUNCTION fn_bot_animal(p_clave text, p_tg bigint, p_diio text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_a animal;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  PERFORM fn_bot_usuario_vinculado(p_tg);
  SELECT * INTO v_a FROM animal WHERE diio = btrim(p_diio);
  IF NOT FOUND THEN PERFORM fn_error('No encontré un animal con DIIO ' || btrim(p_diio) || '.'); END IF;
  RETURN jsonb_build_object(
    'diio', v_a.diio, 'categoria', v_a.categoria, 'de_baja', v_a.fecha_baja IS NOT NULL,
    'resguardo_hasta', (SELECT max(d.fin_resguardo_leche) FROM dosis d JOIN tratamiento t ON t.id = d.tratamiento_id
                         WHERE t.animal_id = v_a.id AND d.estado = 'APLICADA' AND d.fin_resguardo_leche > now()),
    'ultimas', COALESCE((SELECT jsonb_agg(x ORDER BY x.fecha DESC) FROM (
                 SELECT d.fecha_aplicada AS fecha, m.nombre_comercial AS medicamento, d.cantidad, m.unidad_base AS unidad
                   FROM dosis d JOIN tratamiento t ON t.id = d.tratamiento_id JOIN medicamento m ON m.id = d.medicamento_id
                  WHERE t.animal_id = v_a.id AND d.estado = 'APLICADA'
                  ORDER BY d.fecha_aplicada DESC LIMIT 5) x), '[]'::jsonb));
END $$;

-- Valida lo que interpretó el bot y deja el registro pendiente de confirmación. No toca stock.
CREATE OR REPLACE FUNCTION fn_bot_preparar(p_clave text, p_tg bigint, p_chat bigint, p_update bigint, p_texto text,
                                           p_diio text, p_medicamento text, p_cantidad numeric) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u  usuario;
  v_a  animal;
  v_m  medicamento;
  v_l  lote;
  v_n  integer;
  v_id bigint;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  v_u := fn_bot_usuario_vinculado(p_tg);
  IF v_u.rol NOT IN ('ADMIN', 'OPERARIO') THEN PERFORM fn_error('Tu rol no permite registrar tratamientos.'); END IF;
  IF p_diio IS NULL OR p_diio !~ '^[0-9]{9}$' THEN PERFORM fn_error('Falta el DIIO del animal (9 dígitos).'); END IF;
  SELECT * INTO v_a FROM animal WHERE diio = p_diio;
  IF NOT FOUND THEN PERFORM fn_error('No encontré un animal con DIIO ' || p_diio || '.'); END IF;
  IF v_a.fecha_baja IS NOT NULL THEN PERFORM fn_error('El animal ' || p_diio || ' está dado de baja.'); END IF;
  IF COALESCE(p_cantidad, 0) <= 0 THEN PERFORM fn_error('Falta la cantidad de la dosis.'); END IF;
  IF NULLIF(btrim(p_medicamento), '') IS NULL THEN PERFORM fn_error('Falta el medicamento.'); END IF;

  SELECT count(*) INTO v_n FROM medicamento WHERE activo AND nombre_comercial ILIKE '%' || btrim(p_medicamento) || '%';
  IF v_n = 0 THEN PERFORM fn_error('No encontré el medicamento «' || btrim(p_medicamento) || '».'); END IF;
  IF v_n > 1 THEN PERFORM fn_error('Hay ' || v_n || ' medicamentos que coinciden con «' || btrim(p_medicamento) || '». Escribe el nombre más completo.'); END IF;
  SELECT * INTO v_m FROM medicamento WHERE activo AND nombre_comercial ILIKE '%' || btrim(p_medicamento) || '%';

  v_l := fn_bot_lote_fefo(v_m.id, p_cantidad);
  IF v_l.id IS NULL THEN
    PERFORM fn_error('Stock insuficiente: ningún lote vigente de ' || v_m.nombre_comercial || ' tiene ' || p_cantidad || ' ' || v_m.unidad_base || '.');
  END IF;

  INSERT INTO mensaje_bot (telegram_update_id, telegram_chat_id, telegram_from_id, usuario_id, texto, intencion,
                           animal_diio_propuesto, medicamento_id, cantidad_propuesta, fecha_propuesta)
  VALUES (p_update, p_chat, p_tg, v_u.id, left(p_texto, 1000), 'REGISTRAR_TRATAMIENTO', p_diio, v_m.id, p_cantidad, now())
  ON CONFLICT (telegram_update_id) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN PERFORM fn_error('Este mensaje ya se procesó.'); END IF;

  RETURN jsonb_build_object('mensaje_id', v_id, 'diio', p_diio, 'categoria', v_a.categoria, 'medicamento', v_m.nombre_comercial,
                            'cantidad', p_cantidad, 'unidad', v_m.unidad_base, 'lote', v_l.numero_lote,
                            'vence', v_l.fecha_vencimiento, 'resguardo_dias', v_m.resguardo_leche_dias);
END $$;

-- Confirma o cancela un registro pendiente. Al confirmar crea el tratamiento y aplica la dosis
-- con las funciones del panel, como el usuario vinculado y con origen TELEGRAM.
CREATE OR REPLACE FUNCTION fn_bot_confirmar(p_clave text, p_tg bigint, p_mensaje bigint, p_confirmar boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_u     usuario;
  v_msg   mensaje_bot;
  v_a     animal;
  v_l     lote;
  v_t     bigint;
  v_dosis dosis;
BEGIN
  PERFORM fn_bot_validar(p_clave);
  v_u := fn_bot_usuario_vinculado(p_tg);
  SELECT * INTO v_msg FROM mensaje_bot WHERE id = p_mensaje AND telegram_from_id = p_tg FOR UPDATE;
  IF NOT FOUND THEN PERFORM fn_error('No encontré ese registro.'); END IF;
  IF v_msg.estado <> 'RECIBIDO' THEN PERFORM fn_error('Ese registro ya fue ' || lower(v_msg.estado) || '.'); END IF;

  IF NOT p_confirmar THEN
    UPDATE mensaje_bot SET estado = 'CANCELADO', fecha_respuesta = now() WHERE id = p_mensaje;
    RETURN jsonb_build_object('estado', 'CANCELADO');
  END IF;
  IF v_msg.fecha_recepcion < now() - interval '30 minutes' THEN
    UPDATE mensaje_bot SET estado = 'CANCELADO', fecha_respuesta = now(), detalle_error = 'Confirmación vencida' WHERE id = p_mensaje;
    RETURN jsonb_build_object('estado', 'CANCELADO', 'error', 'Pasaron más de 30 minutos. Envía el registro de nuevo.');
  END IF;

  BEGIN
    PERFORM fn_bot_actuar_como(v_u);
    SELECT * INTO v_a FROM animal WHERE diio = v_msg.animal_diio_propuesto;
    v_t := fn_crear_tratamiento(v_a.id,
             jsonb_build_object('indicado_por', 'Registro por Telegram de ' || v_u.nombres, 'motivo', left(v_msg.texto, 200)),
             jsonb_build_array(jsonb_build_object('medicamento_id', v_msg.medicamento_id, 'cantidad', v_msg.cantidad_propuesta,
                                                  'fecha_programada', now())));
    SELECT * INTO v_dosis FROM dosis WHERE tratamiento_id = v_t;
    v_l := fn_bot_lote_fefo(v_msg.medicamento_id, v_msg.cantidad_propuesta);
    IF v_l.id IS NULL THEN PERFORM fn_error('Stock insuficiente: ya no queda un lote vigente con esa cantidad.'); END IF;
    PERFORM fn_aplicar_dosis(v_dosis.id, v_l.id, now());
  EXCEPTION WHEN raise_exception OR insufficient_privilege THEN
    UPDATE mensaje_bot SET estado = 'ERROR', fecha_respuesta = now(), detalle_error = left(SQLERRM, 300) WHERE id = p_mensaje;
    RETURN jsonb_build_object('estado', 'ERROR', 'error', SQLERRM);
  END;

  SELECT * INTO v_dosis FROM dosis WHERE id = v_dosis.id;
  UPDATE mensaje_bot SET estado = 'CONFIRMADO', dosis_id = v_dosis.id, fecha_respuesta = now() WHERE id = p_mensaje;
  RETURN jsonb_build_object('estado', 'CONFIRMADO', 'lote', v_l.numero_lote, 'resguardo_hasta', v_dosis.fin_resguardo_leche);
END $$;

-- El texto libre del operario se borra a los 30 días; lo registrado queda en las tablas.
SELECT cron.schedule('moncopulli-retencion-bot', '30 3 * * *',
  $$UPDATE public.mensaje_bot SET texto = NULL WHERE texto IS NOT NULL AND fecha_recepcion < now() - interval '30 days'$$);

REVOKE ALL ON FUNCTION fn_bot_validar(text), fn_bot_usuario_vinculado(bigint), fn_bot_actuar_como(usuario),
                       fn_bot_lote_fefo(bigint, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_generar_codigo_telegram(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_generar_codigo_telegram(bigint) TO authenticated;
REVOKE ALL ON FUNCTION fn_bot_vincular(text, bigint, text, text), fn_bot_stock(text, bigint), fn_bot_animal(text, bigint, text),
                       fn_bot_preparar(text, bigint, bigint, bigint, text, text, text, numeric),
                       fn_bot_confirmar(text, bigint, bigint, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_bot_vincular(text, bigint, text, text), fn_bot_stock(text, bigint), fn_bot_animal(text, bigint, text),
                       fn_bot_preparar(text, bigint, bigint, bigint, text, text, text, numeric),
                       fn_bot_confirmar(text, bigint, bigint, boolean) TO anon;

COMMIT;
