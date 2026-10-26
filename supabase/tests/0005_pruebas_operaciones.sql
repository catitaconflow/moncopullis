-- =====================================================================
-- Pruebas de la migración 0005 (operaciones del panel).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- Cada rol se simula fijando el "sub" del JWT, que es lo que lee auth.uid().
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '10000001-1', 'Ana', 'Admin', 'p.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000000b2', '10000002-2', 'Omar', 'Operario', 'p.operario@prueba.cl', 'OPERARIO'),
  ('00000000-0000-0000-0000-0000000000c3', '10000003-3', 'Aurora', 'Auditora', 'p.auditor@prueba.cl', 'AUDITOR');

CREATE TEMP TABLE ctx (k text PRIMARY KEY, v bigint);

CREATE FUNCTION pg_temp.como(p_rol text) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims', json_build_object('sub', CASE p_rol
    WHEN 'ADMIN' THEN '00000000-0000-0000-0000-0000000000a1'
    WHEN 'OPERARIO' THEN '00000000-0000-0000-0000-0000000000b2'
    ELSE '00000000-0000-0000-0000-0000000000c3' END, 'role', 'authenticated')::text, true);
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

DO $$
DECLARE
  v_med bigint; v_lote bigint; v_animal bigint; v_trat bigint; v_trat2 bigint; v_dosis bigint;
  v_stock numeric; v_n integer;
BEGIN
  -- O1: el operario no puede crear medicamentos
  PERFORM pg_temp.como('OPERARIO');
  PERFORM pg_temp.debe_fallar('O1',
    $q$SELECT fn_guardar_medicamento(NULL, '{"nombre_comercial":"TEST_OP","unidad_base":"ML","contenido_envase":10}')$q$,
    'No tienes permiso');

  -- O2: el admin crea un medicamento y queda auditado
  PERFORM pg_temp.como('ADMIN');
  v_med := fn_guardar_medicamento(NULL, '{"nombre_comercial":"TEST_0005","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":10,"resguardo_leche_dias":3}');
  IF NOT EXISTS (SELECT 1 FROM auditoria WHERE entidad = 'medicamento' AND entidad_id = v_med AND accion = 'CREAR' AND origen = 'WEBAPP') THEN
    RAISE EXCEPTION 'O2 FALLA: no se auditó la creación';
  END IF;

  -- O3: nombre repetido sin distinguir mayúsculas
  PERFORM pg_temp.debe_fallar('O3',
    $q$SELECT fn_guardar_medicamento(NULL, '{"nombre_comercial":"test_0005","unidad_base":"ML","contenido_envase":1}')$q$,
    'Ya existe un medicamento');

  -- O4: el operario registra una entrada que crea el lote; se abre alerta de stock bajo (5 < 10)
  PERFORM pg_temp.como('OPERARIO');
  PERFORM fn_registrar_entrada(v_med, 'L-0005', DATE '2030-01-31', 5, NULL, 'Compra de prueba');
  SELECT id, stock_lote INTO v_lote, v_stock FROM lote WHERE medicamento_id = v_med AND numero_lote = 'L-0005';
  IF v_stock <> 5 OR (SELECT stock_actual FROM medicamento WHERE id = v_med) <> 5 THEN
    RAISE EXCEPTION 'O4 FALLA: el stock debía ser 5';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM alerta WHERE tipo = 'STOCK_BAJO' AND medicamento_id = v_med AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'O4 FALLA: no se abrió la alerta de stock bajo';
  END IF;

  -- O5: el operario no puede asignar proveedor
  INSERT INTO proveedor (rut, razon_social) VALUES ('20000005-5', 'TEST_PROV_0005');
  PERFORM pg_temp.debe_fallar('O5',
    format('SELECT fn_registrar_entrada(%s, %L, DATE %L, 1, (SELECT id FROM proveedor WHERE rut = %L), NULL)',
           v_med, 'L-0005', '2030-01-31', '20000005-5'),
    'Solo un administrador');

  -- O6: mismo lote con otro vencimiento se rechaza
  PERFORM pg_temp.debe_fallar('O6',
    format('SELECT fn_registrar_entrada(%s, %L, DATE %L, 1, NULL, NULL)', v_med, 'L-0005', '2031-01-01'),
    'ya existe con vencimiento');

  -- O7: una segunda entrada deja el stock sobre el mínimo y cierra la alerta sola
  PERFORM fn_registrar_entrada(v_med, 'L-0005', DATE '2030-01-31', 10, NULL, NULL);
  IF (SELECT stock_actual FROM medicamento WHERE id = v_med) <> 15 THEN RAISE EXCEPTION 'O7 FALLA: el stock debía ser 15'; END IF;
  IF EXISTS (SELECT 1 FROM alerta WHERE tipo = 'STOCK_BAJO' AND medicamento_id = v_med AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'O7 FALLA: la alerta de stock bajo siguió abierta';
  END IF;

  -- O8: un ajuste de salida mayor al stock del lote se rechaza con mensaje claro
  PERFORM pg_temp.debe_fallar('O8', format('SELECT fn_registrar_ajuste(%s, %L, 20, %L, NULL)', v_lote, 'SALIDA_AJUSTE', 'CONTEO'),
                              'Stock insuficiente');

  -- O9: ajuste por conteo de 3 unidades
  PERFORM fn_registrar_ajuste(v_lote, 'SALIDA_AJUSTE', 3, 'CONTEO', 'Diferencia en el conteo mensual');
  IF (SELECT stock_lote FROM lote WHERE id = v_lote) <> 12 THEN RAISE EXCEPTION 'O9 FALLA: el lote debía quedar en 12'; END IF;

  -- O10: el motivo OTRO exige observaciones
  PERFORM pg_temp.debe_fallar('O10', format('SELECT fn_registrar_ajuste(%s, %L, 1, %L, NULL)', v_lote, 'SALIDA_AJUSTE', 'OTRO'),
                              'debes explicar');

  -- O11: animal y tratamiento con una dosis programada
  v_animal := fn_guardar_animal(NULL, '{"diio":"999000555","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  v_trat := fn_crear_tratamiento(v_animal, '{"indicado_por":"Dra. Prueba","motivo":"Mastitis"}',
              json_build_array(json_build_object('medicamento_id', v_med, 'cantidad', 4, 'fecha_programada', now() - interval '1 hour'))::jsonb);
  SELECT id INTO v_dosis FROM dosis WHERE tratamiento_id = v_trat;
  IF (SELECT estado FROM dosis WHERE id = v_dosis) <> 'PROGRAMADA' THEN RAISE EXCEPTION 'O11 FALLA: la dosis debía quedar programada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM alerta WHERE tipo = 'DOSIS_ATRASADA' AND dosis_id = v_dosis AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'O11 FALLA: la dosis con fecha pasada debía abrir una alerta de dosis atrasada';
  END IF;

  -- O12: el estado productivo solo aplica a vacas
  PERFORM pg_temp.debe_fallar('O12', $q$SELECT fn_guardar_animal(NULL, '{"categoria":"TORO","estado_productivo":"SECA"}')$q$,
                              'solo aplica a vacas');

  -- O13: no se puede dar de baja un animal con dosis programadas
  PERFORM pg_temp.debe_fallar('O13', format('SELECT fn_dar_baja_animal(%s, current_date, %L)', v_animal, 'VENTA'),
                              'dosis programadas');

  -- O14: aplicar la dosis descuenta el lote, calcula el resguardo y cierra la alerta de atraso
  PERFORM fn_aplicar_dosis(v_dosis, v_lote, now());
  IF (SELECT stock_lote FROM lote WHERE id = v_lote) <> 8 THEN RAISE EXCEPTION 'O14 FALLA: el lote debía quedar en 8'; END IF;
  IF (SELECT fin_resguardo_leche FROM dosis WHERE id = v_dosis) IS NULL THEN RAISE EXCEPTION 'O14 FALLA: falta el fin de resguardo'; END IF;
  IF EXISTS (SELECT 1 FROM alerta WHERE tipo = 'DOSIS_ATRASADA' AND dosis_id = v_dosis AND estado = 'ABIERTA') THEN
    RAISE EXCEPTION 'O14 FALLA: la alerta de dosis atrasada siguió abierta';
  END IF;

  -- O15: una dosis no se aplica dos veces
  PERFORM pg_temp.debe_fallar('O15', format('SELECT fn_aplicar_dosis(%s, %s, now())', v_dosis, v_lote), 'Solo se puede aplicar');

  -- O16: el operario no puede anular; el admin sí, y el stock vuelve al lote
  PERFORM pg_temp.debe_fallar('O16', format('SELECT fn_anular_tratamiento(%s, %L)', v_trat, 'Error'), 'No tienes permiso');
  PERFORM pg_temp.como('ADMIN');
  PERFORM fn_anular_tratamiento(v_trat, 'Registrado en el animal equivocado');
  IF (SELECT stock_lote FROM lote WHERE id = v_lote) <> 12 THEN RAISE EXCEPTION 'O16 FALLA: el stock debía volver a 12'; END IF;
  IF (SELECT estado FROM dosis WHERE id = v_dosis) <> 'ANULADA' THEN RAISE EXCEPTION 'O16 FALLA: la dosis debía quedar anulada'; END IF;
  IF (SELECT count(*) FROM movimiento_inventario WHERE dosis_id = v_dosis AND tipo = 'REVERSA_DOSIS') <> 1 THEN
    RAISE EXCEPTION 'O16 FALLA: debía haber una reversa';
  END IF;

  -- O17: la baja se acepta cuando ya no hay dosis programadas
  PERFORM fn_dar_baja_animal(v_animal, current_date, 'VENTA');
  IF (SELECT motivo_baja FROM animal WHERE id = v_animal) <> 'VENTA' THEN RAISE EXCEPTION 'O17 FALLA: no se registró la baja'; END IF;

  -- O18: la modificación guarda el detalle campo por campo
  PERFORM fn_guardar_medicamento(v_med, '{"nombre_comercial":"TEST_0005","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":20,"resguardo_leche_dias":3}');
  IF NOT EXISTS (SELECT 1 FROM auditoria a JOIN auditoria_detalle d ON d.auditoria_id = a.id
                  WHERE a.entidad = 'medicamento' AND a.entidad_id = v_med AND d.campo = 'stock_minimo'
                    AND d.valor_anterior::numeric = 10 AND d.valor_nuevo::numeric = 20) THEN
    RAISE EXCEPTION 'O18 FALLA: falta el detalle del cambio de stock_minimo';
  END IF;
  SELECT count(*) INTO v_n FROM auditoria a JOIN auditoria_detalle d ON d.auditoria_id = a.id
   WHERE a.entidad = 'medicamento' AND a.entidad_id = v_med AND a.accion = 'MODIFICAR';
  IF v_n <> 1 THEN RAISE EXCEPTION 'O18 FALLA: solo debía guardarse el campo que cambió (%)', v_n; END IF;

  -- O19: el admin no puede quitarse su propio rol
  PERFORM pg_temp.debe_fallar('O19',
    $q$SELECT fn_actualizar_usuario((SELECT id FROM usuario WHERE email = 'p.admin@prueba.cl'), 'OPERARIO', true)$q$,
    'No puedes quitarte');

  -- O20: el auditor solo exporta tablas de consulta y la exportación queda registrada
  PERFORM pg_temp.como('AUDITOR');
  PERFORM pg_temp.debe_fallar('O20',
    $q$SELECT fn_registrar_exportacion('usuario', 'CSV', 3, repeat('a', 64))$q$, 'solo puede exportar');
  PERFORM fn_registrar_exportacion('auditoria', 'JSON', 5, repeat('b', 64));
  IF NOT EXISTS (SELECT 1 FROM intercambio WHERE alcance = 'auditoria' AND sha256 = repeat('b', 64)) THEN
    RAISE EXCEPTION 'O20 FALLA: no se registró la exportación';
  END IF;

  RAISE NOTICE 'Pruebas O1 a O20: TODAS PASAN';
END $$;

-- O21: el rol anónimo no puede ejecutar las operaciones (permiso de la función)
SET LOCAL ROLE anon;
DO $$
BEGIN
  PERFORM fn_registrar_ajuste(1, 'SALIDA_AJUSTE', 1, 'CONTEO', NULL);
  RAISE EXCEPTION 'O21 FALLA: anon ejecutó la función';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'O21 PASA: anon no tiene permiso de ejecución';
END $$;
RESET ROLE;

ROLLBACK;
