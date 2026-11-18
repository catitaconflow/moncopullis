-- 0016: las funciones de trigger no se exponen por la API.
-- Hallazgo de la revisión del 18-11-2026: fn_solo_insercion, fn_mov_actualiza_stock, fn_mov_lote_de_dosis y
-- fn_medicamento_protege_stock tenían EXECUTE para PUBLIC (permiso por defecto de PostgreSQL). Llamarlas directo
-- falla ("trigger functions can only be called as triggers"), así que no era explotable, pero no deben figurar
-- como RPC. Los triggers siguen funcionando: PostgreSQL no revisa EXECUTE al disparar un trigger.
-- No cambia tablas ni datos.
BEGIN;

REVOKE ALL ON FUNCTION fn_solo_insercion() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_mov_actualiza_stock() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_mov_lote_de_dosis() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION fn_medicamento_protege_stock() FROM PUBLIC, anon, authenticated;

COMMIT;
