-- =====================================================================
-- Pruebas de la migración 0008 (bot de Telegram).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000008a1', '10000081-4', 'Ana', 'Admin', 'bot.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000008b2', '10000082-2', 'Omar', 'Operario', 'bot.operario@prueba.cl', 'OPERARIO'),
  ('00000000-0000-0000-0000-0000000008c3', '10000083-0', 'Aurora', 'Auditora', 'bot.auditor@prueba.cl', 'AUDITOR');

-- Clave de prueba del bot. OJO: este archivo debe correr completo; el ROLLBACK final restaura la clave real.
DELETE FROM bot_clave;
INSERT INTO bot_clave (hash) VALUES (sha256(convert_to('clave-prueba', 'UTF8')));

CREATE FUNCTION pg_temp.como(p_sub text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', p_sub, 'role', 'authenticated')::text, true);
$$;

CREATE FUNCTION pg_temp.debe_fallar(p_prueba text, p_sql text, p_texto text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RAISE EXCEPTION '% FALLA: se aceptó la operación', p_prueba;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM LIKE p_prueba || ' FALLA%' THEN RAISE; END IF;
  IF position(p_texto IN SQLERRM) = 0 THEN
    RAISE EXCEPTION '% FALLA: mensaje inesperado: %', p_prueba, SQLERRM;
  END IF;
END $$;

DO $$
DECLARE
  v_admin text := '00000000-0000-0000-0000-0000000008a1';
  v_op    bigint := (SELECT id FROM usuario WHERE email = 'bot.operario@prueba.cl');
  v_med   bigint;
  v_cod   text;
  v_r     jsonb;
  v_txt   text;
  v_stock numeric;
BEGIN
  -- Datos: medicamento con 3 días de resguardo, 50 ml en un lote y una vaca
  PERFORM pg_temp.como(v_admin);
  v_med := fn_guardar_medicamento(NULL, '{"nombre_comercial":"BOTMICINA 0008","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":10,"resguardo_leche_dias":3}');
  PERFORM fn_registrar_entrada(v_med, 'L-BOT', DATE '2030-01-31', 50, NULL, 'Compra de prueba');
  PERFORM fn_guardar_animal(NULL, '{"diio":"999000808","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  PERFORM set_config('request.jwt.claims', '', true);

  -- B1: una clave equivocada se rechaza
  PERFORM pg_temp.debe_fallar('B1', $q$SELECT fn_bot_stock('otra', 1)$q$, 'Clave del bot inválida');

  -- B2: una cuenta de Telegram sin vincular no puede consultar
  PERFORM pg_temp.debe_fallar('B2', $q$SELECT fn_bot_stock('clave-prueba', 808)$q$, 'no está vinculada');

  -- B3: el auditor no genera códigos; cada usuario genera solo el suyo (0009)
  PERFORM pg_temp.como('00000000-0000-0000-0000-0000000008c3');
  PERFORM pg_temp.debe_fallar('B3', 'SELECT fn_generar_codigo_telegram()', 'No tienes permiso');

  -- B4: código incorrecto descuenta intentos sin revelar nada; el correcto vincula y queda auditado con origen TELEGRAM
  PERFORM pg_temp.como('00000000-0000-0000-0000-0000000008b2');
  v_cod := fn_generar_codigo_telegram();
  PERFORM set_config('request.jwt.claims', '', true);
  v_txt := fn_bot_vincular('clave-prueba', 808, 'BOT.OPERARIO@prueba.cl', '000000x');
  IF position('incorrecto o vencido' IN v_txt) = 0 OR (SELECT telegram_codigo_intentos FROM usuario WHERE id = v_op) <> 1 THEN
    RAISE EXCEPTION 'B4 FALLA: %', v_txt;
  END IF;
  IF fn_bot_vincular('clave-prueba', 808, 'nadie@prueba.cl', '123456') <> v_txt THEN
    RAISE EXCEPTION 'B4 FALLA: el mensaje cambia si el correo no existe';
  END IF;
  v_txt := fn_bot_vincular('clave-prueba', 808, 'bot.operario@prueba.cl', v_cod);
  IF position('vinculada' IN v_txt) = 0 OR (SELECT telegram_user_id FROM usuario WHERE id = v_op) <> 808 THEN
    RAISE EXCEPTION 'B4 FALLA: no vinculó: %', v_txt;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auditoria WHERE entidad = 'usuario' AND entidad_id = v_op AND origen = 'TELEGRAM') THEN
    RAISE EXCEPTION 'B4 FALLA: la vinculación no quedó auditada con origen TELEGRAM';
  END IF;

  -- B5: el código ya usado no sirve otra vez, y quien ya está vinculado no genera otro
  IF position('incorrecto o vencido' IN fn_bot_vincular('clave-prueba', 909, 'bot.operario@prueba.cl', v_cod)) = 0 THEN
    RAISE EXCEPTION 'B5 FALLA: el código se usó dos veces';
  END IF;
  PERFORM pg_temp.como('00000000-0000-0000-0000-0000000008b2');
  PERFORM pg_temp.debe_fallar('B5', 'SELECT fn_generar_codigo_telegram()', 'ya tiene Telegram vinculado');
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM fn_bot_verificar('clave-prueba', 808);
  PERFORM pg_temp.debe_fallar('B5', $q$SELECT fn_bot_verificar('clave-prueba', 909)$q$, 'no está vinculada');

  -- B6: consultas del animal
  v_r := fn_bot_animal('clave-prueba', 808, '999000808');
  IF v_r ->> 'diio' <> '999000808' THEN RAISE EXCEPTION 'B6 FALLA: %', v_r; END IF;

  -- B7: preparar valida animal, medicamento y stock sin tocar el stock
  PERFORM pg_temp.debe_fallar('B7', $q$SELECT fn_bot_preparar('clave-prueba', 808, 1, 80801, 't', '999999999', 'BOTMICINA', 5)$q$,
                              'No encontré un animal');
  PERFORM pg_temp.debe_fallar('B7', $q$SELECT fn_bot_preparar('clave-prueba', 808, 1, 80802, 't', '999000808', 'NOEXISTE', 5)$q$,
                              'No encontré el medicamento');
  PERFORM pg_temp.debe_fallar('B7', $q$SELECT fn_bot_preparar('clave-prueba', 808, 1, 80803, 't', '999000808', 'botmicina', 500)$q$,
                              'Stock insuficiente');
  v_r := fn_bot_preparar('clave-prueba', 808, 1, 80804, 'apliqué 5 ml de botmicina a la 999000808', '999000808', 'botmicina', 5);
  IF v_r ->> 'lote' <> 'L-BOT' OR (SELECT stock_actual FROM medicamento WHERE id = v_med) <> 50 THEN
    RAISE EXCEPTION 'B7 FALLA: %', v_r;
  END IF;

  -- B8: otro usuario de Telegram no puede confirmar el registro ajeno
  PERFORM pg_temp.debe_fallar('B8', format('SELECT fn_bot_confirmar(%L, 909, %s, true)', 'clave-prueba', v_r ->> 'mensaje_id'),
                              'no está vinculada');

  -- B9: confirmar aplica la dosis, descuenta el lote y audita con origen TELEGRAM a nombre del operario
  v_r := fn_bot_confirmar('clave-prueba', 808, (v_r ->> 'mensaje_id')::bigint, true);
  SELECT stock_actual INTO v_stock FROM medicamento WHERE id = v_med;
  IF v_r ->> 'estado' <> 'CONFIRMADO' OR v_stock <> 45 OR (v_r ->> 'resguardo_hasta') IS NULL THEN
    RAISE EXCEPTION 'B9 FALLA: % stock %', v_r, v_stock;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM dosis d JOIN mensaje_bot m ON m.dosis_id = d.id
                  WHERE d.origen = 'TELEGRAM' AND d.aplicado_por = v_op AND m.estado = 'CONFIRMADO')
     OR NOT EXISTS (SELECT 1 FROM movimiento_inventario WHERE medicamento_id = v_med AND tipo = 'SALIDA_DOSIS' AND origen = 'TELEGRAM')
     OR NOT EXISTS (SELECT 1 FROM auditoria WHERE entidad = 'dosis' AND usuario_id = v_op AND origen = 'TELEGRAM') THEN
    RAISE EXCEPTION 'B9 FALLA: falta origen TELEGRAM en dosis, movimiento o auditoría';
  END IF;

  -- B10: no se confirma dos veces
  PERFORM pg_temp.debe_fallar('B10', format('SELECT fn_bot_confirmar(%L, 808, %s, true)', 'clave-prueba',
                              (SELECT max(id) FROM mensaje_bot WHERE telegram_from_id = 808)), 'ya fue confirmado');

  -- B11: cancelar no toca el stock
  v_r := fn_bot_preparar('clave-prueba', 808, 1, 80805, 't', '999000808', 'botmicina', 5);
  v_r := fn_bot_confirmar('clave-prueba', 808, (v_r ->> 'mensaje_id')::bigint, false);
  IF v_r ->> 'estado' <> 'CANCELADO' OR (SELECT stock_actual FROM medicamento WHERE id = v_med) <> 45 THEN
    RAISE EXCEPTION 'B11 FALLA: %', v_r;
  END IF;

  -- B12: el panel sigue registrando con origen WEBAPP
  PERFORM pg_temp.como(v_admin);
  PERFORM fn_registrar_entrada(v_med, 'L-BOT', DATE '2030-01-31', 1, NULL, NULL);
  IF NOT EXISTS (SELECT 1 FROM movimiento_inventario WHERE medicamento_id = v_med AND tipo = 'ENTRADA' AND cantidad = 1 AND origen = 'WEBAPP') THEN
    RAISE EXCEPTION 'B12 FALLA: el panel ya no registra WEBAPP';
  END IF;

  -- B13: anon puede llamar a las funciones del bot, pero no a las internas
  IF NOT has_function_privilege('anon', 'fn_bot_stock(text, bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_bot_actuar_como(usuario)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_generar_codigo_telegram()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_bot_validar(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'B13 FALLA: permisos de ejecución incorrectos';
  END IF;
END $$;

SELECT 'B1 a B13: TODAS PASAN' AS resultado;
ROLLBACK;
