-- =====================================================================
-- REINICIO ANTES DEL PILOTO. BORRA TODOS LOS DATOS DE OPERACIÓN.
--
-- Uso único: vaciar la base después de las pruebas con datos ficticios y
-- antes de cargar datos reales de la empresa. Conserva las cuentas
-- (tabla usuario y Supabase Auth).
--
-- Antes de ejecutarlo:
--   1. Confirmar que no hay datos reales en la base.
--   2. Respaldar: npx supabase db dump --linked --data-only -f respaldo_antes_reinicio.sql
--   3. Ejecutar: npx supabase db query --linked -f pruebas/datos/reiniciar_preproduccion.sql
--
-- TRUNCATE no dispara los triggers de fila, por eso no hace falta
-- desactivar la protección de solo inserción de auditoría e historial.
-- =====================================================================

BEGIN;

TRUNCATE TABLE
  alerta,
  mensaje_bot,
  movimiento_inventario,
  documento_veterinario,
  dosis,
  tratamiento,
  lote,
  medicamento,
  animal,
  propietario,
  proveedor,
  auditoria_detalle,
  auditoria,
  intercambio,
  importacion_registro,
  importacion
RESTART IDENTITY;

-- Deja constancia del reinicio en la auditoría nueva
INSERT INTO auditoria (usuario_id, accion, entidad, origen, descripcion)
VALUES (NULL, 'MODIFICAR', 'base_de_datos', 'SISTEMA', 'Reinicio antes del piloto: se eliminaron los datos de prueba');

COMMIT;
