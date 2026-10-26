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
