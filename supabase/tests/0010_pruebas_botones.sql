-- =====================================================================
-- Pruebas de la migración 0010 (registro por botones).
-- Todo ocurre dentro de una transacción que termina en ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('00000000-0000-0000-0000-0000000010a1', '10000101-2', 'Ana', 'Admin', 'b10.admin@prueba.cl', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000010b2', '10000102-0', 'Omar', 'Operario', 'b10.operario@prueba.cl', 'OPERARIO'),
  ('00000000-0000-0000-0000-0000000010c3', '10000103-9', 'Aurora', 'Auditora', 'b10.auditor@prueba.cl', 'AUDITOR');

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
  v_admin text := '00000000-0000-0000-0000-0000000010a1';
  v_op    bigint := (SELECT id FROM usuario WHERE email = 'b10.operario@prueba.cl');
  v_med   bigint;
  v_cod   text;
  v_r     jsonb;
  v_txt   text;
  v_stock numeric;
BEGIN
  -- Datos: medicamento con 3 días de resguardo, 50 ml en un lote y una vaca
  PERFORM pg_temp.como(v_admin);
  v_med := fn_guardar_medicamento(NULL, '{"nombre_comercial":"BOTMICINA 0010","unidad_base":"ML","contenido_envase":100,
                                          "stock_minimo":10,"resguardo_leche_dias":3}');
  PERFORM fn_registrar_entrada(v_med, 'L-BOT', DATE '2030-01-31', 50, NULL, 'Compra de prueba');
  PERFORM fn_guardar_animal(NULL, '{"diio":"999000808","categoria":"VACA","estado_productivo":"LACTANCIA"}');
  PERFORM set_config('request.jwt.claims', '', true);

  -- Vincular al operario directamente para estas pruebas
  UPDATE usuario SET telegram_user_id = 1010 WHERE id = v_op;
  PERFORM set_config('request.jwt.claims', '', true);

  -- C1: las opciones traen el animal y solo medicamentos con stock
  v_r := fn_bot_opciones('clave-prueba', 1010);
  IF NOT (v_r -> 'animales') @> '[{"diio":"999000808"}]' OR NOT (v_r -> 'medicamentos') @> jsonb_build_array(jsonb_build_object('id', v_med))
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_r -> 'medicamentos') e WHERE (e ->> 'stock')::numeric <= 0) THEN
    RAISE EXCEPTION 'C1 FALLA: %', v_r;
  END IF;

  -- C2: preparar por id y confirmar descuenta el stock
  v_r := fn_bot_preparar_id('clave-prueba', 1010, 1, 101001, 'Botones', '999000808', v_med, 5);
  v_r := fn_bot_confirmar('clave-prueba', 1010, (v_r ->> 'mensaje_id')::bigint, true);
  IF v_r ->> 'estado' <> 'CONFIRMADO' OR (SELECT stock_actual FROM medicamento WHERE id = v_med) <> 45 THEN
    RAISE EXCEPTION 'C2 FALLA: %', v_r;
  END IF;

  -- C3: medicamento inexistente o desconocido de Telegram
  PERFORM pg_temp.debe_fallar('C3', $q$SELECT fn_bot_preparar_id('clave-prueba', 1010, 1, 101002, 't', '999000808', -1, 5)$q$, 'no existe');
  PERFORM pg_temp.debe_fallar('C3', $q$SELECT fn_bot_opciones('clave-prueba', 4040)$q$, 'no está vinculada');

  -- C4: el texto libre sigue funcionando a través de fn_bot_preparar_id
  v_r := fn_bot_preparar('clave-prueba', 1010, 1, 101003, 't', '999000808', 'botmicina', 2);
  IF v_r ->> 'medicamento' <> 'BOTMICINA 0010' THEN RAISE EXCEPTION 'C4 FALLA: %', v_r; END IF;
END $$;

SELECT 'C1 a C4: TODAS PASAN' AS resultado;
ROLLBACK;
