-- =====================================================================
-- Pruebas de la migración 0003 (ejecutar en SQL Editor de Supabase).
-- Todo ocurre dentro de una transacción y termina en ROLLBACK.
-- =====================================================================

BEGIN;

ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_auth_user_id_fkey;

INSERT INTO usuario (auth_user_id, rut, nombres, apellidos, email, rol) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '40000044-4', 'Admin', 'Importa', 'admin@prueba.cl', 'ADMIN'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '55555555-5', 'Operario', 'Importa', 'operario@prueba.cl', 'OPERARIO');

-- Sesión de ADMIN (auth.uid() lee este claim)
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);

-- PRUEBA I1: un lote válido se importa completo
DO $$
DECLARE r jsonb;
BEGIN
  r := fn_importar_exportacion('TEST-EXP-1',
    '[{"uuid":"6f1c2d3e-4a5b-4c6d-8e7f-901234567890","entidad":"animal","datos":{"diio":"123456789"}}]'::jsonb);
  IF r ->> 'estado' <> 'importado' THEN
    RAISE EXCEPTION 'PRUEBA I1 FALLA: se esperaba importado, llegó %', r;
  END IF;
END $$;

-- PRUEBA I2: repetir el mismo export no duplica nada (idempotencia)
DO $$
DECLARE r jsonb; n integer;
BEGIN
  r := fn_importar_exportacion('TEST-EXP-1',
    '[{"uuid":"6f1c2d3e-4a5b-4c6d-8e7f-901234567890","entidad":"animal","datos":{"diio":"123456789"}}]'::jsonb);
  IF r ->> 'estado' <> 'ya_importado' THEN
    RAISE EXCEPTION 'PRUEBA I2 FALLA: el segundo envío no fue reconocido como repetido';
  END IF;
  SELECT count(*) INTO n FROM importacion_registro ir
    JOIN importacion i ON i.id = ir.importacion_id WHERE i.export_id = 'TEST-EXP-1';
  IF n <> 1 THEN
    RAISE EXCEPTION 'PRUEBA I2 FALLA: hay % registros, debía haber 1', n;
  END IF;
END $$;

-- PRUEBA I3: una entidad no permitida no deja nada escrito (todo o nada)
DO $$
DECLARE n integer;
BEGIN
  BEGIN
    PERFORM fn_importar_exportacion('TEST-EXP-2',
      '[{"uuid":"6f1c2d3e-4a5b-4c6d-8e7f-901234567891","entidad":"usuario","datos":{}}]'::jsonb);
    RAISE EXCEPTION 'PRUEBA I3 FALLA: se aceptó una entidad no permitida';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA I3 FALLA%' OR position('no se puede importar' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
  SELECT count(*) INTO n FROM importacion WHERE export_id = 'TEST-EXP-2';
  IF n <> 0 THEN
    RAISE EXCEPTION 'PRUEBA I3 FALLA: quedó escrito el export con error';
  END IF;
END $$;

-- PRUEBA I4: un uuid mal formado se rechaza
DO $$
BEGIN
  BEGIN
    PERFORM fn_importar_exportacion('TEST-EXP-3',
      '[{"uuid":"no-es-uuid","entidad":"animal","datos":{}}]'::jsonb);
    RAISE EXCEPTION 'PRUEBA I4 FALLA: se aceptó un uuid inválido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA I4 FALLA%' OR position('uuid no es válido' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA I5: el historial importado no se puede modificar
DO $$
BEGIN
  BEGIN
    UPDATE importacion_registro SET entidad = 'lote';
    RAISE EXCEPTION 'PRUEBA I5 FALLA: se modificó el historial de importación';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA I5 FALLA%' THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA I7 (0011): la importación queda en la auditoría como IMPORTAR
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auditoria a JOIN importacion i ON i.id = a.entidad_id
                  WHERE a.accion = 'IMPORTAR' AND a.entidad = 'importacion' AND i.export_id = 'TEST-EXP-1') THEN
    RAISE EXCEPTION 'PRUEBA I7 FALLA: la importación no quedó en la auditoría';
  END IF;
END $$;

-- PRUEBA I8 (0011): un archivo con uuid repetido se rechaza completo
DO $$
BEGIN
  BEGIN
    PERFORM fn_importar_exportacion('TEST-EXP-5',
      '[{"uuid":"6f1c2d3e-4a5b-4c6d-8e7f-901234567892","entidad":"animal","datos":{}},
        {"uuid":"6F1C2D3E-4A5B-4C6D-8E7F-901234567892","entidad":"lote","datos":{}}]'::jsonb);
    RAISE EXCEPTION 'PRUEBA I8 FALLA: se aceptó un uuid repetido';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'PRUEBA I8 FALLA%' OR position('repite uuid' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END $$;

-- PRUEBA I6: un OPERARIO no puede importar
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true);
DO $$
BEGIN
  BEGIN
    PERFORM fn_importar_exportacion('TEST-EXP-4', '[{"uuid":"6f1c2d3e-4a5b-4c6d-8e7f-901234567893","entidad":"animal","datos":{}}]'::jsonb);
    RAISE EXCEPTION 'PRUEBA I6 FALLA: un OPERARIO pudo importar';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- esperado
  END;
END $$;

SELECT 'PRUEBAS DE IMPORTACIÓN PASARON (la transacción se revierte)' AS resultado;

ROLLBACK;
