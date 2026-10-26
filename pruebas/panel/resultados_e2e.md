# Prueba E2E del panel (Playwright) — 26/10/2026

Objetivo: https://moncopulli-panel.itskay666.workers.dev (producción), cuenta ADMIN de prueba.
Viewports: 1280×800 y 360×800. Duración: 34 s. Resultado: 12 de 12 pasan.

| ID | Caso | Esperado | Obtenido | Pasa |
|----|------|----------|----------|------|
| E1 | Ruta protegida sin sesión | Redirige a /login | /login | Sí |
| E2 | Login con contraseña incorrecta | "Correo o contraseña incorrectos." | Igual | Sí |
| E3 | Login correcto | Resumen con rol ADMIN | Resumen; rol ADMIN | Sí |
| E4 | Tarjeta "bajo el mínimo" | Inventario filtrado con 4 filas | Filtro "Bajo mínimo 4", 4 filas | Sí |
| E5 | Búsqueda sin coincidencias | Estado vacío | "Ningún medicamento coincide con el filtro." | Sí |
| E6 | Detalle de lotes | Se abre y se cierra | Se abre y se cierra | Sí |
| E7 | Filtros de animales | Activos + De baja = Todos = filas | 6 + 0 = 6; 6 filas | Sí |
| E8 | Tratamientos sin datos | Estado vacío, sin error | "Aún no hay tratamientos registrados." | Sí |
| E9 | Auditoría paginada | "Anterior" deshabilitado en pág. 1 | Deshabilitado | Sí |
| E10 | Ruta inexistente | Página no encontrada | Página no encontrada | Sí |
| E11 | Desborde horizontal (5 pantallas × 2 anchos) | 0 | 0 | Sí |
| E12 | Cerrar sesión en móvil | Vuelve a /login | /login | Sí |

Capturas: 01_login.png a 06_movil_inventario.png en esta carpeta.
Limitación: los datos son ficticios ([FALSO]); tratamientos y lotes por vencer están vacíos, por lo que E8 prueba el estado vacío y no el listado con datos.

# Prueba E2E de escritura (26/10/2026, después de la migración 0005)

Objetivo: panel en desarrollo (`npm run dev`) contra la base de Supabase del proyecto, cuenta ADMIN, datos marcados [FALSO].
Resultado: 14 de 14 casos con el comportamiento esperado.

| ID | Caso | Obtenido | Pasa |
|----|------|----------|------|
| W1 | Crear medicamento "[FALSO] Prueba E2E 98266" | Aparece en la lista; aviso "Medicamento creado." | Sí |
| W2 | Entrada de 50 ml en lote nuevo PRUEBA-E2E-1 | Lote con stock 50, vence 31-12-2027 | Sí |
| W3 | Ajuste de salida de 999 (mayor al stock) | Rechazado en el formulario: "El lote tiene solo 50 ML." | Sí |
| W4 | Ajuste de salida de 5 por conteo físico | Stock 45; historial: Entrada +50 y Ajuste de salida −5, con usuario | Sí |
| W5 | Registrar vaca en lactancia DIIO 900000077 | Aparece en la lista | Sí |
| W6 | Tratamiento con una dosis de 5 ml desde el detalle del animal | Creado, diálogo cerrado sin error | Sí |
| W7 | Aplicar la dosis eligiendo el lote | Solo ofrece lotes vigentes con stock; muestra "No entregar leche hasta 28-10 16:15" (2 días de resguardo) | Sí |
| W8 | Stock después de aplicar | Baja de 45 a 40 | Sí |
| W9 | Actualizar alertas | 4 alertas abiertas de stock bajo | Sí |
| W10 | Resolver una alerta con comentario | Pasa de 4 a 3 abiertas | Sí |
| W11 | Anular el tratamiento (ADMIN) | El stock vuelve de 40 a 45 (reversa de la dosis) | Sí |
| W12 | Auditoría | Registra CREAR, MODIFICAR y ANULAR con usuario y origen WEBAPP | Sí |
| W13 | Exportar auditoría en CSV | Descarga moncopulli-auditoria-20261026-1616.csv y muestra SHA-256 | Sí |
| W14 | Móvil 360 px (viewport emulado) | 0 desbordes en 8 pantallas; diálogos de 328 px sin desborde interno | Sí |

Hallazgos durante la prueba:
- Los diálogos no se abrían en desarrollo: React (StrictMode) cerraba el `<dialog>` al montar el efecto dos veces y el evento `close` cerraba el diálogo nuevo. Corregido en `components/Dialogo.tsx`.
- La primera medición en "360 px" se hizo en realidad a 450 px, porque la ventana del navegador de pruebas no baja de ese ancho en Windows. Se repitió con un contexto de viewport emulado de 360 px.
- Una alerta resuelta a mano se vuelve a abrir si la condición sigue vigente (decisión de diseño, documentada en el manual de usuario).
- Las pruebas SQL 0003 y 0005 chocaban con datos ficticios ya cargados (RUT 44444444-4 y DIIO 900000005). Se cambiaron los valores de las pruebas.
