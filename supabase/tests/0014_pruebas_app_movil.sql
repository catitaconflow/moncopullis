-- =====================================================================
-- Pruebas de la migración 0014 (app móvil).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Cada rol se simula fijando el "sub" del JWT, que es lo que lee auth.uid().
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000014a1', '10000141-1', 'Ana', 'Admin', 'app.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000014b2', '10000142-2', 'Omar', 'Operario', 'app.operario@prueba.cl', 'OPERARIO'),
  ('00000000-0000-0000-0000-0000000014c3', '10000143-3', 'Aurora', 'Auditora', 'app.auditor@prueba.cl', 'AUDITOR');

CREATE FUNCTION pg_temp.como(p_rol text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', CASE p_rol
    WHEN 'ADMIN' THEN '00000000-0000-0000-0000-0000000014a1'
    WHEN 'OPERARIO' THEN '00000000-0000-0000-0000-0000000014b2'
    ELSE '00000000-0000-0000-0000-0000000014c3' END, 'role', 'authenticated')::text, true);
$$;

-- Comprueba que una llamada falla con un mensaje que contiene p_texto
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

-- Llama a fn_app_registrar_aplicacion por nombre, como lo hace la app
CREATE FUNCTION pg_temp.registrar(p_uuid uuid, p_diio text, p_med bigint, p_cant numeric, p_indicado text,
                                  p_fecha timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT fn_app_registrar_aplicacion(p_uuid => p_uuid, p_diio => p_diio, p_medicamento_id => p_med,
                                     p_cantidad => p_cant, p_indicado_por => p_indicado, p_fecha_aplicada => p_fecha);
$$;

DO $$
DECLARE
  v_op     bigint := (SELECT id FROM usuario WHERE email = 'app.operario@prueba.cl');
  v_med    bigint;
  v_pronto bigint;
  v_lejano bigint;
  v_viejo  bigint;
  v_animal bigint;
  v_trat   bigint;
  v_d1     bigint;
  v_d2     bigint;
  v_d3     bigint;
  v_r      jsonb;
  v_r2     jsonb;
  v_u1     uuid := '11111111-1111-4111-8111-111111111111';
  v_u2     uuid := '22222222-2222-4222-8222-222222222222';
  v_u3     uuid := '33333333-3333-4333-8333-333333333333';
  v_u4     uuid := '44444444-4444-4444-8444-444444444444';
  v_u5     uuid := '55555555-5555-4555-8555-555555555555';
BEGIN
  -- Datos: medicamento con 3 días de resguardo y tres lotes (uno vencido, uno próximo y uno lejano)
  PERFORM pg_temp.como('ADMIN');
  v_med := fn_guardar_medicamento(NULL, '{"nombre_comercial":"APPMICINA 0014","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":5,"resguardo_leche_dias":3}');
  PERFORM fn_registrar_entrada(v_med, 'L-VENCIDO', DATE '2020-01-31', 100, NULL, NULL);
  PERFORM fn_registrar_entrada(v_med, 'L-LEJANO',  DATE '2031-06-30', 50, NULL, NULL);
  PERFORM fn_registrar_entrada(v_med, 'L-PRONTO',  DATE '2030-01-31', 20, NULL, NULL);
  SELECT id INTO v_viejo  FROM lote WHERE medicamento_id = v_med AND numero_lote = 'L-VENCIDO';
  SELECT id INTO v_lejano FROM lote WHERE medicamento_id = v_med AND numero_lote = 'L-LEJANO';
  SELECT id INTO v_pronto FROM lote WHERE medicamento_id = v_med AND numero_lote = 'L-PRONTO';
  PERFORM fn_guardar_animal(NULL, '{"diio":"999001401","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  PERFORM fn_guardar_animal(NULL, '{"diio":"999001402","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  PERFORM fn_dar_baja_animal((SELECT id FROM animal WHERE diio = '999001402'), current_date, 'VENTA');
  SELECT id INTO v_animal FROM animal WHERE diio = '999001401';

  -- M1: el operario registra en terreno (sin parámetros opcionales): FEFO elige el lote próximo y no el vencido
  PERFORM pg_temp.como('OPERARIO');
  v_r := fn_app_registrar_aplicacion(p_uuid => v_u1, p_diio => '999001401', p_medicamento_id => v_med,
                                     p_cantidad => 10, p_indicado_por => 'Dr. Pérez');
  IF v_r ->> 'estado' <> 'creado' OR v_r ->> 'lote' <> 'L-PRONTO' OR (v_r ->> 'resguardo_hasta') IS NULL THEN
    RAISE EXCEPTION 'M1 FALLA: respuesta inesperada %', v_r;
  END IF;
  IF (SELECT stock_lote FROM lote WHERE id = v_pronto) <> 10 OR (SELECT stock_lote FROM lote WHERE id = v_viejo) <> 100 THEN
    RAISE EXCEPTION 'M1 FALLA: el stock del lote debía bajar solo en L-PRONTO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM tratamiento t JOIN dosis d ON d.tratamiento_id = t.id
                  WHERE t.uuid = v_u1 AND t.creado_por = v_op AND t.indicado_por = 'Dr. Pérez' AND t.animal_id = v_animal
                    AND d.estado = 'APLICADA' AND d.aplicado_por = v_op AND d.origen = 'APPMOVIL'
                    AND d.fin_resguardo_leche IS NOT NULL AND d.cantidad = 10) THEN
    RAISE EXCEPTION 'M1 FALLA: tratamiento o dosis mal registrados';
  END IF;
  IF (SELECT count(*) FROM movimiento_inventario WHERE dosis_id = (v_r ->> 'dosis_id')::bigint AND tipo = 'SALIDA_DOSIS' AND origen = 'APPMOVIL') <> 1 THEN
    RAISE EXCEPTION 'M1 FALLA: debía haber una salida de stock con origen APPMOVIL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auditoria WHERE entidad = 'tratamiento' AND entidad_id = (v_r ->> 'tratamiento_id')::bigint
                    AND accion = 'CREAR' AND usuario_id = v_op AND descripcion LIKE '%app móvil%' AND origen = 'APPMOVIL') THEN
    RAISE EXCEPTION 'M1 FALLA: falta la auditoría del registro en terreno';
  END IF;

  -- M2: repetir el mismo p_uuid no duplica nada y devuelve lo mismo con estado ya_registrado
  v_r2 := pg_temp.registrar(v_u1, '999001401', v_med, 10, 'Dr. Pérez');
  IF v_r2 ->> 'estado' <> 'ya_registrado' OR v_r2 - 'estado' <> v_r - 'estado' THEN
    RAISE EXCEPTION 'M2 FALLA: el reintento debía devolver lo mismo. Primero %, reintento %', v_r, v_r2;
  END IF;
  IF (SELECT count(*) FROM tratamiento WHERE uuid = v_u1) <> 1 OR (SELECT stock_lote FROM lote WHERE id = v_pronto) <> 10 THEN
    RAISE EXCEPTION 'M2 FALLA: el reintento tocó datos o stock';
  END IF;

  -- M3: el reintento sigue siendo ya_registrado aunque el stock ya no alcance para repetir la dosis
  PERFORM fn_registrar_ajuste(v_pronto, 'SALIDA_AJUSTE', 10, 'CONTEO', NULL);
  PERFORM fn_registrar_ajuste(v_lejano, 'SALIDA_AJUSTE', 50, 'CONTEO', NULL);
  PERFORM fn_registrar_ajuste(v_viejo, 'SALIDA_AJUSTE', 100, 'VENCIDO', NULL);
  IF pg_temp.registrar(v_u1, '999001401', v_med, 10, 'Dr. Pérez') ->> 'estado' <> 'ya_registrado' THEN
    RAISE EXCEPTION 'M3 FALLA: el reintento debía responder ya_registrado';
  END IF;
  -- M4: sin stock vigente se rechaza con mensaje claro y no queda nada a medias
  PERFORM pg_temp.debe_fallar('M4', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999001401', v_med, 'Dr. Pérez'),
                              'Stock insuficiente');
  IF EXISTS (SELECT 1 FROM tratamiento WHERE uuid = v_u2) THEN RAISE EXCEPTION 'M4 FALLA: quedó un tratamiento sin dosis'; END IF;
  PERFORM fn_registrar_entrada(v_med, 'L-PRONTO', DATE '2030-01-31', 8, NULL, NULL);
  PERFORM fn_registrar_entrada(v_med, 'L-LEJANO', DATE '2031-06-30', 50, NULL, NULL);

  -- M5: validaciones con mensaje para el usuario
  PERFORM pg_temp.como('OPERARIO');
  PERFORM pg_temp.debe_fallar('M5a', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999001401', v_med, '   '),
                              'Indica quién prescribe');
  PERFORM pg_temp.debe_fallar('M5b', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '123', v_med, 'Dr. Pérez'),
                              '9 dígitos');
  PERFORM pg_temp.debe_fallar('M5c', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999009999', v_med, 'Dr. Pérez'),
                              'No existe un animal');
  PERFORM pg_temp.debe_fallar('M5d', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999001402', v_med, 'Dr. Pérez'),
                              'dado de baja');
  PERFORM pg_temp.debe_fallar('M5e', format('SELECT pg_temp.registrar(%L, %L, %s, 0, %L)', v_u2, '999001401', v_med, 'Dr. Pérez'),
                              'mayor que 0');
  PERFORM pg_temp.debe_fallar('M5f', format('SELECT pg_temp.registrar(%L, %L, %s, 0.004, %L)', v_u2, '999001401', v_med, 'Dr. Pérez'),
                              'mayor que 0');
  PERFORM pg_temp.debe_fallar('M5g', format('SELECT pg_temp.registrar(%L, %L, 0, 1, %L)', v_u2, '999001401', 'Dr. Pérez'),
                              'no existe o está inactivo');
  PERFORM pg_temp.debe_fallar('M5h', format('SELECT pg_temp.registrar(NULL, %L, %s, 1, %L)', '999001401', v_med, 'Dr. Pérez'),
                              'identificador');
  PERFORM pg_temp.debe_fallar('M5i', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L, now() + interval %L)',
                                            v_u2, '999001401', v_med, 'Dr. Pérez', '1 hour'),
                              'no puede ser futura');
  PERFORM pg_temp.debe_fallar('M5j', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999001401', v_med, repeat('x', 121)),
                              'hasta 120');

  -- M6: un registro hecho sin conexión días antes conserva su fecha y calcula el resguardo desde ella
  v_r := pg_temp.registrar(v_u3, '999001401', v_med, 2, 'Dr. Pérez', now() - interval '2 days');
  IF NOT EXISTS (SELECT 1 FROM dosis WHERE id = (v_r ->> 'dosis_id')::bigint
                    AND fecha_aplicada BETWEEN now() - interval '2 days 1 minute' AND now() - interval '2 days' + interval '1 minute'
                    AND fin_resguardo_leche BETWEEN now() + interval '1 day' - interval '1 minute' AND now() + interval '1 day' + interval '1 minute') THEN
    RAISE EXCEPTION 'M6 FALLA: la fecha o el resguardo no corresponden a la fecha de aplicación';
  END IF;

  -- M7: el mismo p_uuid de otro usuario no se puede reutilizar
  PERFORM pg_temp.como('ADMIN');
  PERFORM pg_temp.debe_fallar('M7', format('SELECT pg_temp.registrar(%L, %L, %s, 10, %L)', v_u1, '999001401', v_med, 'Dr. Pérez'),
                              'pertenece a otro usuario');

  -- M8: el auditor no registra ni aplica
  PERFORM pg_temp.como('AUDITOR');
  PERFORM pg_temp.debe_fallar('M8a', format('SELECT pg_temp.registrar(%L, %L, %s, 1, %L)', v_u2, '999001401', v_med, 'Dr. Pérez'),
                              'No tienes permiso');
  PERFORM pg_temp.debe_fallar('M8b', 'SELECT fn_app_aplicar_dosis(1)', 'No tienes permiso');

  -- Tres dosis programadas (una atrasada) para probar fn_app_aplicar_dosis
  PERFORM pg_temp.como('ADMIN');
  v_trat := fn_crear_tratamiento(v_animal, '{"indicado_por":"Dr. Soto"}',
    jsonb_build_array(jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now() - interval '1 hour'),
                      jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now() + interval '1 day'),
                      jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now() + interval '2 days')));
  SELECT (array_agg(id ORDER BY id))[1], (array_agg(id ORDER BY id))[2], (array_agg(id ORDER BY id))[3]
    INTO v_d1, v_d2, v_d3 FROM dosis WHERE tratamiento_id = v_trat;
  IF NOT EXISTS (SELECT 1 FROM alerta WHERE tipo = 'DOSIS_ATRASADA' AND dosis_id = v_d1 AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'M9 FALLA: faltaba la alerta de dosis atrasada para la prueba';
  END IF;

  -- M9: el operario aplica la dosis programada; FEFO usa L-PRONTO (6 >= 5); la alerta de atraso se cierra
  PERFORM pg_temp.como('OPERARIO');
  v_r := fn_app_aplicar_dosis(v_d1);
  IF v_r ->> 'estado' <> 'creado' OR v_r ->> 'lote' <> 'L-PRONTO' OR (v_r ->> 'dosis_id')::bigint <> v_d1 THEN
    RAISE EXCEPTION 'M9 FALLA: respuesta inesperada %', v_r;
  END IF;
  IF (SELECT stock_lote FROM lote WHERE id = v_pronto) <> 1 THEN RAISE EXCEPTION 'M9 FALLA: L-PRONTO debía quedar en 1'; END IF;
  IF EXISTS (SELECT 1 FROM alerta WHERE tipo = 'DOSIS_ATRASADA' AND dosis_id = v_d1 AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'M9 FALLA: la alerta de dosis atrasada siguió abierta';
  END IF;

  -- M10: reintento del mismo usuario = ya_registrado sin tocar el stock
  v_r2 := fn_app_aplicar_dosis(v_d1);
  IF v_r2 ->> 'estado' <> 'ya_registrado' OR v_r2 - 'estado' <> v_r - 'estado' OR (SELECT stock_lote FROM lote WHERE id = v_pronto) <> 1 THEN
    RAISE EXCEPTION 'M10 FALLA: el reintento debía ser idempotente. %', v_r2;
  END IF;

  -- M11: otro usuario no puede "reaplicar" una dosis que ya aplicó el operario
  PERFORM pg_temp.como('ADMIN');
  PERFORM pg_temp.debe_fallar('M11', format('SELECT fn_app_aplicar_dosis(%s)', v_d1), 'ya fue aplicada por otro usuario');

  -- M12: si el primer lote ya no alcanza (1 < 5), FEFO pasa al siguiente (L-LEJANO)
  PERFORM pg_temp.como('OPERARIO');
  v_r := fn_app_aplicar_dosis(v_d2, now());
  IF v_r ->> 'lote' <> 'L-LEJANO' THEN RAISE EXCEPTION 'M12 FALLA: debía usar L-LEJANO y usó %', v_r ->> 'lote'; END IF;

  -- M13: una dosis omitida ya no se aplica; una dosis inexistente da mensaje claro
  PERFORM fn_omitir_dosis(v_d3, 'Se suspendió la terapia');
  PERFORM pg_temp.debe_fallar('M13a', format('SELECT fn_app_aplicar_dosis(%s)', v_d3), 'Solo se puede aplicar una dosis programada');
  PERFORM pg_temp.debe_fallar('M13b', 'SELECT fn_app_aplicar_dosis(0)', 'La dosis no existe');
  PERFORM pg_temp.debe_fallar('M13c', format('SELECT fn_app_aplicar_dosis(%s, now() + interval %L)', v_d3, '1 hour'), 'Solo se puede aplicar');

  -- M14: el stock del medicamento sigue siendo la suma de sus lotes
  IF (SELECT stock_actual FROM medicamento WHERE id = v_med) <> (SELECT sum(stock_lote) FROM lote WHERE medicamento_id = v_med) THEN
    RAISE EXCEPTION 'M14 FALLA: stock_actual no coincide con la suma de lotes';
  END IF;

  -- M15: permisos de ejecución: anon no, authenticated sí, la utilidad interna nadie
  IF has_function_privilege('anon', 'fn_app_registrar_aplicacion(uuid, text, bigint, numeric, text, timestamptz, text, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_app_aplicar_dosis(bigint, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M15 FALLA: anon puede ejecutar las funciones de la app';
  END IF;
  IF NOT has_function_privilege('authenticated', 'fn_app_registrar_aplicacion(uuid, text, bigint, numeric, text, timestamptz, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'fn_app_aplicar_dosis(bigint, timestamptz)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M15 FALLA: authenticated no puede ejecutar las funciones de la app';
  END IF;
  IF has_function_privilege('authenticated', 'fn_app_resumen_dosis(text, bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'M15 FALLA: la utilidad interna quedó expuesta';
  END IF;

  RAISE NOTICE 'Pruebas M1 a M15: TODAS PASAN';
END $$;

-- M16: con el rol real de la API (authenticated, sin permisos directos de escritura) la función funciona
SELECT set_config('prueba.med', (SELECT id::text FROM medicamento WHERE nombre_comercial = 'APPMICINA 0014'), true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000014b2', 'role', 'authenticated')::text, true);
  v_r := fn_app_registrar_aplicacion(p_uuid => '66666666-6666-4666-8666-666666666666', p_diio => '999001401',
                                     p_medicamento_id => current_setting('prueba.med')::bigint,
                                     p_cantidad => 1, p_indicado_por => 'Dr. Pérez');
  IF v_r ->> 'estado' <> 'creado' THEN RAISE EXCEPTION 'M16 FALLA: %', v_r; END IF;
  RAISE NOTICE 'M16 PASA: authenticated registra por la función';
END $$;
RESET ROLE;

-- M17: el rol anónimo no puede ejecutar las funciones de la app
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM fn_app_aplicar_dosis(1);
  RAISE EXCEPTION 'M17 FALLA: anon ejecutó la función';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'M17 PASA: anon no tiene permiso de ejecución';
END $$;
RESET ROLE;

ROLLBACK;