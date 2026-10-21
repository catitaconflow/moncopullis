-- =====================================================================
-- Pruebas básicas del esquema (ejecutar en SQL Editor de Supabase).
-- Todo ocurre dentro de una transacción y termina en ROLLBACK:
-- no deja datos en el proyecto. Si una prueba falla, el script se detiene
-- y el mensaje dice cuál.
-- =====================================================================

BEGIN;

-- Se quita solo para la prueba la FK a auth.users (no hay usuarios de Auth de prueba).
ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

-- Datos de prueba
INSERT INTO medicamento (nombre_comercial, unidad_base, contenido_envase)
VALUES ('TEST_MED', 'ML', 100);

INSERT INTO lote (medicamento_id, numero_lote, fecha_vencimiento)
SELECT id, 'TEST_L1', DATE '2027-01-01' FROM medicamento WHERE nombre_comercial = 'TEST_MED';

INSERT INTO lote (medicamento_id, numero_lote, fecha_vencimiento)
SELECT id, 'TEST_L2', DATE '2027-06-01' FROM medicamento WHERE nombre_comercial = 'TEST_MED';

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol)
VALUES (gen_random_uuid(), '11111111-1', 'Test', 'Prueba', 'test@prueba.cl', 'OPERARIO');

INSERT INTO proveedor (rut, razon_social) VALUES ('22222222-2', 'TEST_PROV');

INSERT INTO animal (diio, categoria) VALUES ('999999999', 'VACA');

INSERT INTO tratamiento (uuid, animal_id, indicado_por, creado_por)
SELECT gen_random_uuid(), a.id, 'Veterinario de prueba', u.id
  FROM animal a, usuario u
 WHERE a.diio = '999999999' AND u.email = 'test@prueba.cl';

-- Entradas: 30 en L1 y 20 en L2 (total esperado 50)
INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, proveedor_id, usuario_id, origen, fecha_evento)
SELECT gen_random_uuid(), l.medicamento_id, l.id, 'ENTRADA', 30, p.id, u.id, 'WEBAPP', now()
  FROM lote l, proveedor p, usuario u
 WHERE l.numero_lote = 'TEST_L1' AND p.rut = '22222222-2' AND u.email = 'test@prueba.cl';

INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, proveedor_id, usuario_id, origen, fecha_evento)
SELECT gen_random_uuid(), l.medicamento_id, l.id, 'ENTRADA', 20, p.id, u.id, 'WEBAPP', now()
  FROM lote l, proveedor p, usuario u
 WHERE l.numero_lote = 'TEST_L2' AND p.rut = '22222222-2' AND u.email = 'test@prueba.cl';

-- PRUEBA 1: el stock total es la suma de las entradas
DO $$
BEGIN
  IF (SELECT stock_actual FROM medicamento WHERE nombre_comercial = 'TEST_MED') <> 50 THEN
    RAISE EXCEPTION 'PRUEBA 1 FALLA: el stock total debía ser 50';
  END IF;
END $$;

-- Dosis aplicada de 20 desde el lote L1
INSERT INTO dosis (uuid, tratamiento_id, medicamento_id, lote_id, cantidad, estado, fecha_aplicada, aplicado_por, origen)
SELECT gen_random_uuid(), t.id, l.medicamento_id, l.id, 20, 'APLICADA', now(), u.id, 'WEBAPP'
  FROM tratamiento t, lote l, usuario u
 WHERE l.numero_lote = 'TEST_L1' AND u.email = 'test@prueba.cl';

-- Salida por dosis
INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
SELECT gen_random_uuid(), d.medicamento_id, d.lote_id, 'SALIDA_DOSIS', 20, d.id, u.id, 'WEBAPP', now()
  FROM dosis d, usuario u
 WHERE u.email = 'test@prueba.cl';

-- PRUEBA 2: la salida descuenta del lote y del total
DO $$
BEGIN
  IF (SELECT stock_actual FROM medicamento WHERE nombre_comercial = 'TEST_MED') <> 30 THEN
    RAISE EXCEPTION 'PRUEBA 2 FALLA: tras la salida el total debía ser 30';
  END IF;
  IF (SELECT stock_lote FROM lote WHERE numero_lote = 'TEST_L1') <> 10 THEN
    RAISE EXCEPTION 'PRUEBA 2 FALLA: el lote L1 debía quedar en 10';
  END IF;
END $$;

-- PRUEBA 3: una segunda salida para la misma dosis debe fallar
DO $$
BEGIN
  BEGIN
    INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
    SELECT gen_random_uuid(), d.medicamento_id, d.lote_id, 'SALIDA_DOSIS', 5, d.id, u.id, 'WEBAPP', now()
      FROM dosis d, usuario u WHERE u.email = 'test@prueba.cl';
    RAISE EXCEPTION 'PRUEBA 3 FALLA: se aceptó una segunda salida para la misma dosis';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- esperado
  END;
END $$;

-- PRUEBA 4: una salida mayor al stock del lote debe fallar
DO $$
BEGIN
  BEGIN
    INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, motivo, usuario_id, origen, fecha_evento)
    SELECT gen_random_uuid(), l.medicamento_id, l.id, 'SALIDA_AJUSTE', 999, 'VENCIDO', u.id, 'WEBAPP', now()
      FROM lote l, usuario u WHERE l.numero_lote = 'TEST_L2' AND u.email = 'test@prueba.cl';
    RAISE EXCEPTION 'PRUEBA 4 FALLA: se aceptó una salida mayor al stock del lote';
  EXCEPTION WHEN check_violation THEN
    NULL; -- esperado
  END;
END $$;

-- PRUEBA 5: el historial de inventario no se puede modificar
DO $$
BEGIN
  BEGIN
    UPDATE movimiento_inventario SET cantidad = 1 WHERE tipo = 'ENTRADA';
    RAISE EXCEPTION 'PRUEBA 5 FALLA: se modificó el historial de inventario';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA 5 FALLA%' THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA 6: stock_actual no se puede escribir directamente
DO $$
BEGIN
  BEGIN
    UPDATE medicamento SET stock_actual = 999 WHERE nombre_comercial = 'TEST_MED';
    RAISE EXCEPTION 'PRUEBA 6 FALLA: se escribió stock_actual directamente';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA 6 FALLA%' THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA 7: el lote de un movimiento debe ser el lote de la dosis
DO $$
BEGIN
  BEGIN
    INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
    SELECT gen_random_uuid(), d.medicamento_id, l.id, 'REVERSA_DOSIS', 20, d.id, u.id, 'WEBAPP', now()
      FROM dosis d, lote l, usuario u
     WHERE l.numero_lote = 'TEST_L2' AND u.email = 'test@prueba.cl';
    RAISE EXCEPTION 'PRUEBA 7 FALLA: se aceptó una reversa en un lote distinto al de la dosis';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA 7 FALLA%' THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA 8: la reversa devuelve el stock al lote L1 y al total
INSERT INTO movimiento_inventario (uuid, medicamento_id, lote_id, tipo, cantidad, dosis_id, usuario_id, origen, fecha_evento)
SELECT gen_random_uuid(), d.medicamento_id, d.lote_id, 'REVERSA_DOSIS', 20, d.id, u.id, 'WEBAPP', now()
  FROM dosis d, usuario u WHERE u.email = 'test@prueba.cl';

DO $$
BEGIN
  IF (SELECT stock_actual FROM medicamento WHERE nombre_comercial = 'TEST_MED') <> 50 THEN
    RAISE EXCEPTION 'PRUEBA 8 FALLA: tras la reversa el total debía volver a 50';
  END IF;
END $$;

-- PRUEBA 9: la auditoría no se puede modificar
INSERT INTO auditoria (accion, entidad, entidad_id, origen, descripcion)
VALUES ('PRUEBA', 'medicamento', 1, 'SISTEMA', 'registro de prueba');

DO $$
BEGIN
  BEGIN
    UPDATE auditoria SET descripcion = 'alterado' WHERE accion = 'PRUEBA';
    RAISE EXCEPTION 'PRUEBA 9 FALLA: se modificó la auditoría';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA 9 FALLA%' THEN RAISE; END IF;
  END;
END $$;

SELECT 'TODAS LAS PRUEBAS BÁSICAS PASARON (la transacción se revierte)' AS resultado;

ROLLBACK;
