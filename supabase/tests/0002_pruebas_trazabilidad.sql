-- =====================================================================
-- Pruebas de la migración 0002 (ejecutar en SQL Editor de Supabase).
-- Todo ocurre dentro de una transacción y termina en ROLLBACK.
-- Si una prueba falla, el script se detiene y el mensaje dice cuál.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol)
VALUES (gen_random_uuid(), '33333333-3', 'Test', 'Trazabilidad', 'trazabilidad@prueba.cl', 'OPERARIO');

INSERT INTO animal (diio, categoria) VALUES ('888888888', 'VACA');

-- PRUEBA T1: un animal no puede ser madre de sí mismo
DO $$
BEGIN
  BEGIN
    UPDATE animal SET madre_id = id WHERE diio = '888888888';
    RAISE EXCEPTION 'PRUEBA T1 FALLA: se aceptó un animal como madre de sí mismo';
  EXCEPTION WHEN check_violation THEN
    NULL; -- esperado
  END;
END $$;

-- PRUEBA T2: el origen del ingreso solo admite valores del catálogo
DO $$
BEGIN
  BEGIN
    UPDATE animal SET origen_ingreso = 'INVENTADO' WHERE diio = '888888888';
    RAISE EXCEPTION 'PRUEBA T2 FALLA: se aceptó un origen de ingreso fuera de catálogo';
  EXCEPTION WHEN check_violation THEN
    NULL; -- esperado
  END;
END $$;

-- PRUEBA T3: el sacrificio sanitario es un motivo de baja válido
UPDATE animal SET motivo_baja = 'SACRIFICIO_SANITARIO', fecha_baja = DATE '2026-10-01'
 WHERE diio = '888888888';

-- PRUEBA T4: un documento debe estar asociado a un animal o a un tratamiento
DO $$
BEGIN
  BEGIN
    INSERT INTO documento_veterinario (uuid, usuario_id, ruta_almacenamiento, nombre_original, tipo, origen)
    SELECT gen_random_uuid(), u.id, 'docs/huerfano.pdf', 'huerfano.pdf', 'PDF', 'BOT'
      FROM usuario u WHERE u.email = 'trazabilidad@prueba.cl';
    RAISE EXCEPTION 'PRUEBA T4 FALLA: se aceptó un documento sin animal ni tratamiento';
  EXCEPTION WHEN check_violation THEN
    NULL; -- esperado
  END;
END $$;

-- Documento válido asociado al animal
INSERT INTO documento_veterinario (uuid, animal_id, usuario_id, ruta_almacenamiento, nombre_original, tipo, origen)
SELECT gen_random_uuid(), a.id, u.id, 'docs/prueba/foto.jpg', 'foto.jpg', 'IMAGEN', 'BOT'
  FROM animal a, usuario u
 WHERE a.diio = '888888888' AND u.email = 'trazabilidad@prueba.cl';

-- PRUEBA T5: un documento no puede modificarse ni borrarse
DO $$
BEGIN
  BEGIN
    UPDATE documento_veterinario SET nombre_original = 'alterado' WHERE ruta_almacenamiento = 'docs/prueba/foto.jpg';
    RAISE EXCEPTION 'PRUEBA T5 FALLA: se modificó un documento';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA T5 FALLA%' THEN RAISE; END IF;
  END;
END $$;

SELECT 'PRUEBAS DE TRAZABILIDAD PASARON (la transacción se revierte)' AS resultado;

ROLLBACK;
