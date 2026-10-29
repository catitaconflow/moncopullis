-- 0013: limpieza de objetos que no usa nadie.
-- 1. Las vistas v_* de 0001 no las lee el panel, el bot ni las pruebas. Se crearon sin
--    security_invoker, así que corren con los permisos del dueño y saltan el RLS de las tablas.
-- 2. medicamento_nombre_uk sobra: medicamento_nombre_ci_uk (lower) ya impide el mismo nombre.
-- 3. fn_rol_actual solo la necesitan las políticas de authenticated.
-- No se tocan medicamento_id_unico ni tratamiento_id_unico: también repiten la clave primaria,
-- pero las claves foráneas quedaron apoyadas en esos índices.
BEGIN;

DROP VIEW IF EXISTS v_stock_medicamento;
DROP VIEW IF EXISTS v_dosis_stock_pendiente;
DROP VIEW IF EXISTS v_control_stock;

ALTER TABLE medicamento DROP CONSTRAINT IF EXISTS medicamento_nombre_uk;

REVOKE ALL ON FUNCTION fn_rol_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION fn_rol_actual() TO authenticated;

COMMIT;
