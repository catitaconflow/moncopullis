-- =====================================================================
-- Limpieza de los datos falsos creados por datos_falsos.sql.
-- Orden: primero lo que depende de otras tablas (lotes, animales),
-- luego las tablas maestras. Si algo falla, no se borra nada.
-- =====================================================================

BEGIN;

DELETE FROM lote WHERE numero_lote LIKE 'PRUEBA-%';
DELETE FROM animal WHERE diio LIKE '9000000%';
DELETE FROM medicamento WHERE nombre_comercial LIKE '[FALSO]%';
DELETE FROM propietario WHERE nombre_completo LIKE '[FALSO]%';
DELETE FROM proveedor WHERE razon_social LIKE '[FALSO]%';

SELECT
  (SELECT count(*) FROM propietario WHERE nombre_completo LIKE '[FALSO]%') AS propietarios_restantes,
  (SELECT count(*) FROM proveedor WHERE razon_social LIKE '[FALSO]%') AS proveedores_restantes,
  (SELECT count(*) FROM animal WHERE diio LIKE '9000000%') AS animales_restantes,
  (SELECT count(*) FROM medicamento WHERE nombre_comercial LIKE '[FALSO]%') AS medicamentos_restantes,
  (SELECT count(*) FROM lote WHERE numero_lote LIKE 'PRUEBA-%') AS lotes_restantes;

COMMIT;
