-- =====================================================================
-- Pruebas de la migración 0015 (origen APPMOVIL).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Cada rol se simula fijando el "sub" del JWT, que es lo que lee auth.uid().
-- OJO: las fn_app_* dejan moncopulli.origen = 'APPMOVIL' hasta el fin de la transacción (por la API cada
-- llamada es su propia transacción). Por eso lo del panel (WEBAPP) se prueba ANTES de llamar a la app.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000015a1', '10000151-1', 'Ana', 'Admin', 'origen.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000015b2', '10000152-2', 'Omar', 'Operario', 'origen.operario@prueba.cl', 'OPERARIO'),
  ('00000000-0000-0000-0000-0000000015c3', '10000153-3', 'Aurora', 'Auditora', 'origen.auditor@prueba.cl', 'AUDITOR');

CREATE FUNCTION pg_temp.como(p_rol text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', CASE p_rol
    WHEN 'ADMIN' THEN '00000000-0000-0000-0000-0000000015a1'
    WHEN 'OPERARIO' THEN '00000000-0000-0000-0000-0000000015b2'
    ELSE '00000000-0000-0000-0000-0000000015c3' END, 'role', 'authenticated')::text, true);
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

-- Origen con que quedó auditada una acción (la más reciente que calce)
CREATE FUNCTION pg_temp.origen_aud(p_entidad text, p_id bigint, p_desc text) RETURNS text LANGUAGE sql AS $$
  SELECT origen FROM auditoria WHERE entidad = p_entidad AND entidad_id = p_id AND descripcion LIKE p_desc
   ORDER BY id DESC LIMIT 1;
$$;

DO $$
DECLARE
  v_med    bigint;
  v_lote   bigint;
  v_animal bigint;
  v_trat   bigint;
  v_d1     bigint;
  v_d2     bigint;
  v_d3     bigint;
  v_mov    bigint;
  v_stock  numeric;
BEGIN
  -- Datos: un medicamento con un lote de 50 y un tratamiento con tres dosis programadas
  PERFORM pg_temp.como('ADMIN');
  v_med := fn_guardar_medicamento(NULL, '{"nombre_comercial":"ORIGENMICINA 0015","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":1,"resguardo_leche_dias":0}');
  PERFORM fn_registrar_entrada(v_med, 'L-0015', DATE '2031-06-30', 50, NULL, NULL);
  SELECT id INTO v_lote FROM lote WHERE medicamento_id = v_med AND numero_lote = 'L-0015';
  PERFORM fn_guardar_animal(NULL, '{"diio":"999001501","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  SELECT id INTO v_animal FROM animal WHERE diio = '999001501';
  v_trat := fn_crear_tratamiento(v_animal, '{"indicado_por":"Dr. Soto"}',
    jsonb_build_array(jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now()),
                      jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now()),
                      jsonb_build_object('medicamento_id', v_med, 'cantidad', 5, 'fecha_programada', now())));
  SELECT (array_agg(id ORDER BY id))[1], (array_agg(id ORDER BY id))[2], (array_agg(id ORDER BY id))[3]
    INTO v_d1, v_d2, v_d3 FROM dosis WHERE tratamiento_id = v_trat;

  -- O1: el panel sigue registrando WEBAPP al aplicar una dosis y al hacer un ajuste (fn_registrar_ajuste ahora usa fn_origen)
  PERFORM pg_temp.como('OPERARIO');
  PERFORM fn_aplicar_dosis(v_d3, v_lote, now());
  v_mov := fn_registrar_ajuste(v_lote, 'SALIDA_AJUSTE', 1, 'CONTEO', NULL);
  IF (SELECT origen FROM dosis WHERE id = v_d3) IS DISTINCT FROM 'WEBAPP'
     OR pg_temp.origen_aud('dosis', v_d3, 'Dosis aplicada%') IS DISTINCT FROM 'WEBAPP'
     OR (SELECT origen FROM movimiento_inventario WHERE id = v_mov) IS DISTINCT FROM 'WEBAPP'
     OR pg_temp.origen_aud('movimiento_inventario', v_mov, 'Ajuste de salida%') IS DISTINCT FROM 'WEBAPP' THEN
    RAISE EXCEPTION 'O1 FALLA: el panel debía seguir registrando WEBAPP';
  END IF;

  -- O2: aplicar desde la app deja APPMOVIL en la dosis, el movimiento y la auditoría
  PERFORM fn_app_aplicar_dosis(v_d1);
  IF (SELECT origen FROM dosis WHERE id = v_d1) IS DISTINCT FROM 'APPMOVIL'
     OR (SELECT origen FROM movimiento_inventario WHERE dosis_id = v_d1 AND tipo = 'SALIDA_DOSIS') IS DISTINCT FROM 'APPMOVIL'
     OR pg_temp.origen_aud('dosis', v_d1, 'Dosis aplicada%') IS DISTINCT FROM 'APPMOVIL' THEN
    RAISE EXCEPTION 'O2 FALLA: falta APPMOVIL en dosis, movimiento o auditoría';
  END IF;

  -- Cada prueba de la app empieza "limpia", como una llamada nueva por la API
  PERFORM set_config('moncopulli.origen', '', true);

  -- O3: omitir desde la app queda auditado con APPMOVIL
  PERFORM fn_app_omitir_dosis(v_d2, 'El animal no se encontró');
  IF (SELECT estado FROM dosis WHERE id = v_d2) <> 'OMITIDA'
     OR pg_temp.origen_aud('dosis', v_d2, 'Dosis omitida%') IS DISTINCT FROM 'APPMOVIL' THEN
    RAISE EXCEPTION 'O3 FALLA: la dosis no quedó omitida con auditoría APPMOVIL';
  END IF;
  PERFORM pg_temp.debe_fallar('O3b', format('SELECT fn_app_omitir_dosis(%s, %L)', v_d2, 'otra vez'), 'Solo se puede omitir');
  PERFORM pg_temp.debe_fallar('O3c', format('SELECT fn_app_omitir_dosis(%s, %L)', v_d2, '  '), 'Indica por qué');

  PERFORM set_config('moncopulli.origen', '', true);

  -- O4: salida por ajuste desde la app (sin observaciones: usa el DEFAULT) queda con APPMOVIL
  v_stock := (SELECT stock_lote FROM lote WHERE id = v_lote);
  v_mov := fn_app_registrar_salida(v_lote, 2, 'CONTEO');
  IF (SELECT origen FROM movimiento_inventario WHERE id = v_mov AND tipo = 'SALIDA_AJUSTE') IS DISTINCT FROM 'APPMOVIL'
     OR pg_temp.origen_aud('movimiento_inventario', v_mov, 'Ajuste de salida%') IS DISTINCT FROM 'APPMOVIL'
     OR (SELECT stock_lote FROM lote WHERE id = v_lote) <> v_stock - 2 THEN
    RAISE EXCEPTION 'O4 FALLA: salida sin APPMOVIL o stock mal descontado';
  END IF;

  -- O5: las validaciones del panel siguen aplicando a la app
  PERFORM pg_temp.debe_fallar('O5a', format('SELECT fn_app_registrar_salida(%s, 1, %L)', v_lote, 'OTRO'), 'debes explicar');
  PERFORM pg_temp.debe_fallar('O5b', format('SELECT fn_app_registrar_salida(%s, 9999, %L)', v_lote, 'CONTEO'), 'Stock insuficiente');
  PERFORM pg_temp.debe_fallar('O5c', format('SELECT fn_app_registrar_salida(%s, 0, %L)', v_lote, 'CONTEO'), 'mayor que 0');
  PERFORM pg_temp.debe_fallar('O5d', format('SELECT fn_app_registrar_salida(%s, 1, %L)', v_lote, 'INVENTADO'), 'motivo de ajuste');

  -- O6: el auditor no omite ni registra salidas
  PERFORM pg_temp.como('AUDITOR');
  PERFORM pg_temp.debe_fallar('O6a', format('SELECT fn_app_omitir_dosis(%s, %L)', v_d1, 'x'), 'No tienes permiso');
  PERFORM pg_temp.debe_fallar('O6b', format('SELECT fn_app_registrar_salida(%s, 1, %L)', v_lote, 'CONTEO'), 'No tienes permiso');

  -- O7: los CHECK siguen rechazando orígenes fuera de la lista
  PERFORM pg_temp.debe_fallar('O7', 'INSERT INTO auditoria (accion, entidad, origen) VALUES (''CREAR'', ''prueba_origen'', ''ANDROID'')',
                              'auditoria_origen');

  -- O8: fn_origen solo reconoce valores de su lista; cualquier otro cuenta como WEBAPP
  PERFORM set_config('moncopulli.origen', 'INVENTADO', true);
  IF fn_origen() <> 'WEBAPP' THEN RAISE EXCEPTION 'O8 FALLA: fn_origen aceptó un valor desconocido'; END IF;
  PERFORM set_config('moncopulli.origen', 'APPMOVIL', true);
  IF fn_origen() <> 'APPMOVIL' THEN RAISE EXCEPTION 'O8 FALLA: fn_origen no reconoce APPMOVIL'; END IF;
  PERFORM set_config('moncopulli.origen', '', true);
  IF fn_origen() <> 'WEBAPP' THEN RAISE EXCEPTION 'O8 FALLA: sin valor debía ser WEBAPP'; END IF;

  -- O9: permisos: anon no, authenticated sí; fn_origen no se expone
  IF has_function_privilege('anon', 'fn_app_omitir_dosis(bigint, text)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_app_registrar_salida(bigint, numeric, text, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'fn_app_omitir_dosis(bigint, text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'fn_app_registrar_salida(bigint, numeric, text, text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_origen()', 'EXECUTE') THEN
    RAISE EXCEPTION 'O9 FALLA: permisos de ejecución incorrectos';
  END IF;

  PERFORM set_config('prueba.lote', v_lote::text, true);
  RAISE NOTICE 'Pruebas O1 a O9: TODAS PASAN';
END $$;

-- O10: con el rol real de la API (authenticated) la salida funciona y queda APPMOVIL
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000015b2', 'role', 'authenticated')::text, true);
  PERFORM set_config('prueba.mov', fn_app_registrar_salida(current_setting('prueba.lote')::bigint, 1, 'VENCIDO', 'Prueba O10')::text, true);
END $$;
RESET ROLE;
DO $$
BEGIN
  IF (SELECT origen FROM movimiento_inventario WHERE id = current_setting('prueba.mov')::bigint) IS DISTINCT FROM 'APPMOVIL' THEN
    RAISE EXCEPTION 'O10 FALLA: la salida hecha como authenticated no quedó APPMOVIL';
  END IF;
  RAISE NOTICE 'O10 PASA: authenticated registra la salida con origen APPMOVIL';
END $$;

-- O11: el rol anónimo no puede ejecutar las funciones nuevas
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM fn_app_omitir_dosis(1, 'x');
  RAISE EXCEPTION 'O11 FALLA: anon ejecutó la función';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'O11 PASA: anon no tiene permiso de ejecución';
END $$;
RESET ROLE;

SELECT 'O1 a O11: TODAS PASAN' AS resultado;
ROLLBACK;
