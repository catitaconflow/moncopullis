# Ciclo 3: app móvil v2 (18-11-2026)

Ejecutado con Chrome automatizado (Playwright) contra producción, con la cuenta ADMIN y registros [FALSO]. Las acciones de la app se hicieron por la misma API que usa Android (funciones `fn_app_*` con la sesión de Supabase Auth); el resultado se verificó en el panel publicado y en la base. Script: `ciclo3_navegador.js` (credenciales solo por variables de entorno `C3_EMAIL` y `C3_CLAVE`).

| ID | Caso | Esperado | Obtenido | Pasa |
|---|---|---|---|---|
| C3-02 | Inicio de sesión con contraseña incorrecta | No entra y muestra error | Se queda en el login con mensaje de error | Sí |
| C3-01 | Inicio de sesión ADMIN | Entra al Resumen | Entra al Resumen (/) | Sí |
| C3-04 | Aplicar dosis programada (Inicio → Aplicar) | creado, lote PRUEBA-E2E-1, con resguardo | HTTP 200: creado, lote PRUEBA-E2E-1, resguardo 2026-11-20T03:56:31.665777+00:00 | Sí |
| C3-04b | Reintento de la misma dosis | ya_registrado, sin descontar de nuevo | HTTP 200: ya_registrado | Sí |
| C3-05 | Registrar salida de 1 ml (Inventario) | Devuelve el id del movimiento | HTTP 200: movimiento 90 | Sí |
| C3-07 | Envío de la cola al volver la red (aplicada 3 min antes) | creado y con la hora original | HTTP 200: creado (hora enviada 2026-11-18T03:53:33.228Z) | Sí |
| C3-08 | Registrar aplicación en terreno y reenviarla | creado y luego ya_registrado | creado → ya_registrado | Sí |
| C3-09a | DIIO de 8 dígitos | «El DIIO debe tener 9 dígitos.» | El DIIO debe tener 9 dígitos. | Sí |
| C3-09b | Cantidad 0 | «La cantidad debe ser mayor que 0.» | La cantidad debe ser mayor que 0. | Sí |
| C3-09c | Salida mayor al stock | «Stock insuficiente…» | Stock insuficiente: el lote PRUEBA-E2E-1 tiene 14.00. | Sí |
| C3-09d | Fecha de aplicación futura | «…no puede ser futura.» | La fecha de aplicación no puede ser futura. | Sí |
| C3-11 | Llamar a la app sin sesión | Rechazo (401/403/42501) | HTTP 401: permission denied for function fn_app_aplicar_dosis | Sí |
| C3-12 | Auditoría del panel muestra el origen APPMOVIL | Filas con APPMOVIL | Aparecen filas con APPMOVIL | Sí |

**13 de 13 casos pasan.**

## Verificación en la base (Supabase)

| Comprobación | Resultado |
|---|---|
| Dosis 26 (aplicada desde Inicio) | APLICADA, origen APPMOVIL, lote PRUEBA-E2E-1, resguardo hasta 20-11 00:56 |
| Reintento de la dosis 26 | Una sola SALIDA_DOSIS (no se duplicó) |
| Dosis 27 (envío diferido) | Fecha de aplicación 00:53:33 = la hora original, no la del envío |
| Registro en terreno (dosis 28) | Fecha 00:46:33 = la indicada; reenvío con el mismo uuid no duplicó |
| Stock del lote PRUEBA-E2E-1 | 20 → 14 (2 + 1 + 2 + 1); stock del medicamento = suma de lotes |
| Auditoría | 5 filas con origen APPMOVIL, visibles en la pantalla Auditoría del panel |

Alcance: no incluye los toques en la pantalla del teléfono ni el corte real de la red del dispositivo; la interfaz se cubre con las capturas automáticas (CapturasPantallaTest) y la cola local con AUT-02 (EnvioDaoTest).
