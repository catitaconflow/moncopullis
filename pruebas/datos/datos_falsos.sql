-- =====================================================================
-- DATOS FALSOS DE PRUEBA. Todo lo creado aquí lleva el prefijo [FALSO]
-- o PRUEBA- para poder identificarlo y borrarlo después.
-- Solo tablas maestras: auditoria y movimiento_inventario son de solo
-- inserción y no se incluyen (no se pueden borrar después).
-- Limpieza: ejecutar limpiar_datos_falsos.sql.
-- =====================================================================

BEGIN;

INSERT INTO propietario (rut, nombre_completo, activo) VALUES
  ('77000001-7', '[FALSO] Propietario Prueba Uno', true),
  ('77000002-5', '[FALSO] Propietario Prueba Dos', true);

INSERT INTO proveedor (rut, razon_social, activo) VALUES
  ('77000003-3', '[FALSO] Proveedor Veterinario Prueba', true),
  ('77000004-1', '[FALSO] Distribuidora Prueba', true);

INSERT INTO animal (diio, categoria, estado_productivo, propietario_id, fecha_nacimiento) VALUES
  ('900000001', 'VACA', 'LACTANCIA', NULL, DATE '2019-03-10'),
  ('900000002', 'VACA', 'SECA', NULL, DATE '2018-07-22'),
  ('900000003', 'VACA', 'LACTANCIA', (SELECT id FROM propietario WHERE rut = '77000001-7'), DATE '2020-01-05'),
  ('900000004', 'VAQUILLA', NULL, NULL, DATE '2023-05-14'),
  ('900000005', 'TERNERO', NULL, NULL, DATE '2026-02-01'),
  ('900000006', 'TORO', NULL, (SELECT id FROM propietario WHERE rut = '77000002-5'), DATE '2017-11-30');

INSERT INTO medicamento (nombre_comercial, principio_activo, tipo, via_administracion, unidad_base, contenido_envase, requiere_receta, resguardo_leche_dias, stock_minimo, activo) VALUES
  ('[FALSO] Oxitetraciclina 200', 'oxitetraciclina', 'ANTIBIOTICO', 'INTRAMUSCULAR', 'ML', 100, true, 4, 50, true),
  ('[FALSO] Vacuna Triple Prueba', 'vacuna triple', 'VACUNA', 'SUBCUTANEA', 'ML', 50, false, 0, 20, true),
  ('[FALSO] Antiparasitario Prueba', 'ivermectina', 'ANTIPARASITARIO', 'SUBCUTANEA', 'ML', 500, false, 14, 100, true),
  ('[FALSO] Antiinflamatorio Prueba', 'meloxicam', 'ANTIINFLAMATORIO', 'INTRAVENOSA', 'ML', 100, true, 5, 30, true);

INSERT INTO lote (medicamento_id, numero_lote, fecha_vencimiento, stock_lote, activo) VALUES
  ((SELECT id FROM medicamento WHERE nombre_comercial = '[FALSO] Oxitetraciclina 200'), 'PRUEBA-OXI-01', DATE '2027-06-30', 0, true),
  ((SELECT id FROM medicamento WHERE nombre_comercial = '[FALSO] Oxitetraciclina 200'), 'PRUEBA-OXI-02', DATE '2026-11-20', 0, true),
  ((SELECT id FROM medicamento WHERE nombre_comercial = '[FALSO] Vacuna Triple Prueba'), 'PRUEBA-VAC-01', DATE '2026-08-01', 0, true),
  ((SELECT id FROM medicamento WHERE nombre_comercial = '[FALSO] Antiparasitario Prueba'), 'PRUEBA-ANT-01', DATE '2028-01-15', 0, true),
  ((SELECT id FROM medicamento WHERE nombre_comercial = '[FALSO] Antiinflamatorio Prueba'), 'PRUEBA-AIN-01', DATE '2027-09-30', 0, true);

-- Verificación antes de confirmar
SELECT
  (SELECT count(*) FROM propietario WHERE nombre_completo LIKE '[FALSO]%') AS propietarios,
  (SELECT count(*) FROM proveedor WHERE razon_social LIKE '[FALSO]%') AS proveedores,
  (SELECT count(*) FROM animal WHERE diio LIKE '9000000%') AS animales,
  (SELECT count(*) FROM medicamento WHERE nombre_comercial LIKE '[FALSO]%') AS medicamentos,
  (SELECT count(*) FROM lote WHERE numero_lote LIKE 'PRUEBA-%') AS lotes;

COMMIT;
