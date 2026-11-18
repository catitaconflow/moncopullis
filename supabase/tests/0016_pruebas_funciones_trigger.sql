-- Pruebas de la migración 0016. Todo dentro de una transacción que termina en ROLLBACK.
BEGIN;

DO $$
BEGIN
  -- T1: ni anon ni authenticated pueden ejecutar las funciones de trigger
  IF has_function_privilege('anon', 'fn_solo_insercion()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_solo_insercion()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_mov_actualiza_stock()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_mov_lote_de_dosis()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'fn_medicamento_protege_stock()', 'EXECUTE') THEN
    RAISE EXCEPTION 'T1 FALLA: una función de trigger sigue expuesta';
  END IF;
  -- T2: los triggers siguen activos en sus tablas
  IF (SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       WHERE NOT t.tgisinternal AND p.proname IN ('fn_solo_insercion', 'fn_mov_actualiza_stock',
             'fn_mov_lote_de_dosis', 'fn_medicamento_protege_stock') AND t.tgenabled <> 'D') < 4 THEN
    RAISE EXCEPTION 'T2 FALLA: faltan triggers activos';
  END IF;
  -- T3: la auditoría sigue rechazando UPDATE (el trigger fn_solo_insercion corre)
  BEGIN
    UPDATE auditoria SET descripcion = descripcion WHERE id = (SELECT min(id) FROM auditoria);
    IF FOUND THEN RAISE EXCEPTION 'T3 FALLA: se modificó la auditoría'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'T3 FALLA%' THEN RAISE; END IF;
  END;
  -- T4: el stock no se puede escribir a mano (trigger fn_medicamento_protege_stock)
  BEGIN
    UPDATE medicamento SET stock_actual = stock_actual + 1 WHERE id = (SELECT min(id) FROM medicamento);
    IF FOUND THEN RAISE EXCEPTION 'T4 FALLA: se escribió stock_actual a mano'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'T4 FALLA%' THEN RAISE; END IF;
  END;
END $$;

SELECT 'T1 a T4: TODAS PASAN' AS resultado;
ROLLBACK;
