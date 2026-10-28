# Preguntas probables de la defensa (Moncopulli)

Respuestas basadas en lo que existe en el repositorio y en lo que se ejecutó el 21/10/2026. Donde algo no está hecho, la respuesta lo dice.

## Base de datos

**¿Por qué PostgreSQL y no MySQL?**
El modelo usa CHECK entre columnas, claves compuestas (dosis, medicamento), índices parciales (una sola salida por dosis) y triggers que mantienen el stock por lote. PostgreSQL los soporta todos; MySQL 8 tiene limitaciones en índices parciales y en lógica dentro del motor. Supabase además trae RLS y respaldos.

**¿Cómo se garantiza que el stock nunca sea negativo?**
Con un CHECK `stock_lote >= 0` y un trigger (`fn_mov_actualiza_stock`) que actualiza el saldo en la misma transacción que el movimiento. Lo probamos: la prueba P4 (salida mayor al stock del lote) es rechazada.

**¿Qué pasa si alguien modifica el historial de inventario?**
`movimiento_inventario` y `auditoria` son de solo inserción: un trigger (`fn_solo_insercion`) rechaza UPDATE y DELETE. Prueba P5 y P9.

**¿Por qué `stock_actual` está guardado si es calculable?**
Es la única excepción a la tercera forma normal, y está justificada: consultar el stock de un medicamento sin sumar todos sus lotes. El trigger lo mantiene igual a la suma de los lotes, y la prueba P6 demuestra que no se puede escribir a mano.

**¿Qué versión de la base está desplegada y cómo se sabe?**
Migraciones 0001 a 0004 registradas en el historial de Supabase (`supabase migration list` muestra local y remoto iguales). Hubo un error real: la 0002 se aplicó a mano antes de su ajuste y la prueba 0002 falló. Se corrigió con la 0004 y se documenta como discrepancia P10.

## Seguridad

**¿Qué controla el acceso a los datos?**
RLS activo en las 17 tablas. Cada tabla tiene al menos una política; las de lectura son para el rol `authenticated`. Probamos con el rol `anon`: no ve filas y no puede escribir en `usuario` (pruebas P13 y P14).

**¿El bot de Telegram puede ser suplantado?**
El webhook exige el encabezado `X-Telegram-Bot-Api-Secret-Token`. Sin secreto o con secreto falso responde 403, y lo comprobamos en producción. Las cuentas se vinculan con un código de un solo uso.

**¿Dónde están las claves?**
Fuera del repositorio. El secreto del webhook y las claves de Supabase están en `wrangler secret`. El Worker llama a la base con la clave anon (pública) más una clave propia del bot (`BOT_CLAVE_DB`, 32 bytes aleatorios); la base guarda solo su SHA-256. La clave service_role no se despliega. El `.gitignore` excluye `.env*`.

**¿Qué pruebas de seguridad hicieron?**
Pasivas: OWASP ZAP baseline, sin hallazgos de riesgo alto ni medio; una alerta de riesgo bajo (CORP), ya corregida. Activas básicas: tokens falsos, payload de inyección sin token y RLS como `anon`. **No hay pentest completo**; lo declaramos como pendiente.

**¿Qué cabeceras de seguridad tiene la API?**
HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Content-Security-Policy` restrictiva, `Cross-Origin-Resource-Policy: same-origin` y `Cache-Control: no-store`. Verificadas en producción.

## Pruebas y rendimiento

**¿Cumple el sistema los 500 ms de p95?**
No lo podemos afirmar. Con 5 usuarios, la primera corrida dio p95 de 118 ms; la repetición dio 1 050 ms con errores de socket. Con 20 usuarios, 6 709 ms. Con 50, 1 340 ms y 1,07 % de errores. La misma prueba dio resultados distintos, así que la medición no es reproducible desde una sola máquina. Por eso el informe dice "no concluyente". La siguiente prueba debe hacerse en staging y desde dos equipos.

**¿Por qué las pruebas de carga solo usan rutas de rechazo?**
Para no escribir datos en producción. Las rutas de rechazo (403 y 401) pasan por el mismo servidor, pero no tocan la base. Es una limitación y se declara.

**¿Qué pruebas se ejecutaron realmente?**
- Base de datos: 0001 (9 pruebas), 0002 (5), 0003 (importación). Cada una dentro de una transacción con ROLLBACK.
- Bot: 19 pruebas con `node:test`, incluidas las de cabeceras.
- Carga y pentest: ver las preguntas anteriores.

## Decisiones de diseño

**¿Por qué Cloudflare Workers y no un servidor propio?**
Sin sistema operativo que mantener, HTTPS y webhook nativos, y un plan gratuito suficiente para el piloto. La alternativa era FastAPI en EC2, que exige administrar Nginx y los parches.

**¿Por qué dos tablas, `intercambio` e `importacion`?**
`intercambio` registra las exportaciones y `importacion` las importaciones. Se mantienen separadas para no mezclar el historial de salida con el de entrada. Es una decisión tomada, no un pendiente.

**¿Por qué el panel es de solo lectura?**
Porque las escrituras se hacen por el servidor (Worker), que valida antes de tocar la base. El panel muestra inventario, animales, tratamientos y auditoría. Las escrituras desde el panel son trabajo posterior.

**¿Qué queda fuera del alcance?**
EID (identificación electrónica), trazabilidad de carne y la app Android (fase 2). El modelo registra solo leche.

## Normativa

**¿Qué ley de datos personales aplica?**
La Ley 21.719, con entrada en vigor prevista el 1 de diciembre de 2026. Existe un proyecto (boletín 18.623-07) que propone postergarla; hay que verificar su estado antes de la entrega.

## Preguntas que no sabemos responder todavía

- **¿Cuántas personas usarán el sistema y cuánto tráfico generan?** No hay estimación validada con el predio.
- **¿Qué pasa si Telegram o Gemini no responden?** El bot responde con error y no guarda nada sin confirmación; no hay cola de reintento todavía.
