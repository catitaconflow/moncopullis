-- Pruebas de la huella encadenada de auditoría (R4). Todo se revierte al final.
BEGIN;

DO $$
DECLARE
  v_id     bigint;
  v_antes  text;
BEGIN
  INSERT INTO auditoria (accion, entidad, origen, descripcion)
  VALUES ('MODIFICAR', 'prueba_huella', 'SISTEMA', 'fila de prueba') RETURNING id INTO v_id;
  v_antes := fn_huella_auditoria(v_id);

  -- H1: la huella es estable si nada cambia
  IF fn_huella_auditoria(v_id) <> v_antes THEN RAISE EXCEPTION 'H1 falla: la huella cambió sin cambios'; END IF;

  -- H2: una fila nueva después del id no altera la huella guardada
  INSERT INTO auditoria (accion, entidad, origen) VALUES ('MODIFICAR', 'prueba_huella', 'SISTEMA');
  IF fn_huella_auditoria(v_id) <> v_antes THEN RAISE EXCEPTION 'H2 falla: una fila posterior cambió la huella'; END IF;

  -- H3: alterar una fila saltándose el trigger (modo réplica, P21) cambia la huella
  SET LOCAL session_replication_role = replica;
  UPDATE auditoria SET descripcion = 'alterada' WHERE id = v_id;
  SET LOCAL session_replication_role = origin;
  IF fn_huella_auditoria(v_id) = v_antes THEN RAISE EXCEPTION 'H3 falla: la alteración no se detectó'; END IF;

  -- H4: borrar la fila también cambia la huella
  SET LOCAL session_replication_role = replica;
  DELETE FROM auditoria WHERE id = v_id;
  SET LOCAL session_replication_role = origin;
  IF fn_huella_auditoria(v_id) = v_antes THEN RAISE EXCEPTION 'H4 falla: el borrado no se detectó'; END IF;

  -- H5: los roles del panel no pueden ejecutarla
  IF has_function_privilege('authenticated', 'fn_huella_auditoria(bigint)', 'EXECUTE')
     OR has_function_privilege('anon', 'fn_huella_auditoria(bigint)', 'EXECUTE') THEN
    RAISE EXCEPTION 'H5 falla: anon o authenticated pueden ejecutar la función';
  END IF;

  RAISE NOTICE 'H1 a H5: TODAS PASAN';
END $$;

SELECT 'H1 a H5: TODAS PASAN' AS resultado;
ROLLBACK;
