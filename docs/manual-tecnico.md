# Manual técnico del sistema de trazabilidad Moncopulli

Este documento explica cómo está construido el sistema, cómo instalarlo desde cero y cómo mantenerlo.
Los diagramas están en `docs/diagramas/` (archivos `.drawio` editables y `.png`).

## 1. Componentes

| Carpeta | Qué contiene | Tecnología |
|---------|--------------|------------|
| `supabase/migrations/` | Esquema de la base: tablas, restricciones, RLS, triggers y funciones (0001 a 0013) | PostgreSQL 17 en Supabase |
| `supabase/functions/crear-usuario/` | Alta de usuarios con contraseña temporal | Deno, Supabase Edge Functions |
| `supabase/tests/` | Pruebas SQL que terminan en ROLLBACK | SQL |
| `bot/` | Worker de la API: webhook de Telegram e importación | TypeScript, Cloudflare Workers |
| `panel/` | Panel web para administración, operación y auditoría | React 18, React Router 7, Vite, TypeScript |
| `pruebas/` | Carga (k6 y JMeter), seguridad (ZAP), respaldo, datos de prueba y E2E del panel | SQL, k6, Playwright |
| `.github/workflows/ci.yml` | Integración continua en cada push | GitHub Actions |
| `.github/workflows/respaldo.yml` | Respaldo diario cifrado con prueba de restauración y huella de auditoría | GitHub Actions, Docker, age |
| `.github/workflows/carga.yml` | Prueba de carga a pedido (3 corridas) | GitHub Actions, k6 |

## 2. Requisitos

- Node.js 20 o superior (CI usa 24) y Git.
- Cuenta de Supabase con acceso al proyecto `moncopulli` y cuenta de Cloudflare.
- No se necesita instalar Supabase CLI ni Wrangler: se usan con `npx`.

## 3. Instalación desde cero

```bash
git clone https://github.com/catitaconflow/moncopullis.git
cd moncopullis

# Base de datos
npx supabase login
npx supabase link --project-ref <referencia-del-proyecto>
npx supabase migration list          # compara historial local y remoto
npx supabase db push --dry-run       # muestra qué se aplicaría
npx supabase db push                 # aplica las migraciones pendientes

# Panel
cd panel
npm ci
copy .env.example .env.local         # completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm run dev                          # http://localhost:5173
```

La clave del panel es la `anon`. La clave `service_role` nunca va en el panel ni en el repositorio.

## 4. Base de datos

### 4.1 Reglas que aplica el motor

- El stock (`medicamento.stock_actual` y `lote.stock_lote`) solo cambia insertando en `movimiento_inventario`. Un trigger actualiza ambos en la misma transacción y otro impide escribir el stock a mano.
- `movimiento_inventario`, `auditoria`, `auditoria_detalle`, `intercambio`, `documento_veterinario` e `importacion` son de solo inserción.
- Un lote nunca queda con stock negativo (CHECK). Una dosis tiene como máximo una salida y una reversa.
- Todas las claves foráneas usan `ON DELETE RESTRICT`: lo que tiene historial no se borra, se desactiva o se da de baja.

### 4.2 Lectura y escritura

- **Lectura:** RLS por rol en las 17 tablas (`fn_rol_actual()` lee el rol del usuario conectado).
- **Escritura desde el panel:** no hay políticas de INSERT ni UPDATE. Todo pasa por funciones `SECURITY DEFINER` de la migración 0005. Cada una comprueba el rol, valida los datos con mensajes claros, escribe y registra la auditoría en la misma transacción.

| Función | Roles | Qué hace |
|---------|-------|----------|
| `fn_guardar_medicamento(p_id, p)` | ADMIN | Crea o edita el catálogo (sin tocar el stock) |
| `fn_registrar_entrada(...)` | ADMIN, OPERARIO | Entrada de compra; crea el lote si no existe |
| `fn_registrar_ajuste(...)` | ADMIN, OPERARIO | Ajuste por conteo, vencimiento, rotura u otro |
| `fn_guardar_animal(p_id, p)` / `fn_dar_baja_animal(...)` | ADMIN, OPERARIO | Alta, edición y baja de animales |
| `fn_guardar_propietario(p_id, p)` | ADMIN, OPERARIO | Propietarios de animales arrendados |
| `fn_guardar_proveedor(p_id, p)` | ADMIN | Proveedores |
| `fn_crear_tratamiento(...)` | ADMIN, OPERARIO | Tratamiento con sus dosis programadas |
| `fn_aplicar_dosis(...)` / `fn_omitir_dosis(...)` | ADMIN, OPERARIO | Aplica (descuenta stock y calcula resguardo de leche) u omite |
| `fn_anular_tratamiento(...)` | ADMIN | Anula y devuelve al lote el stock de las dosis aplicadas |
| `fn_actualizar_alertas()` / `fn_resolver_alerta(...)` | ADMIN, OPERARIO | Recalcula y cierra alertas |
| `fn_actualizar_usuario(...)` | ADMIN | Cambia rol o estado (no permite quitarse el propio rol) |
| `fn_crear_usuario(...)` | ADMIN | Registra la fila de `usuario` de una cuenta de Auth recién creada (migración 0012) |
| `fn_registrar_exportacion(...)` | ADMIN, AUDITOR | Registra la exportación con su SHA-256 |

Las alertas (`STOCK_BAJO`, `VENCIMIENTO_PROXIMO` a 60 días y `DOSIS_ATRASADA`) se recalculan después de cada operación que cambia stock o dosis y, desde la migración 0006, también cada hora con pg_cron (tarea `moncopulli-alertas`). Se cierran solas cuando la condición deja de cumplirse.

Para revisar la tarea programada: `select jobname, schedule, active from cron.job;`. Para pausarla: `select cron.unschedule('moncopulli-alertas');`.

### 4.3 Huella de auditoría (migración 0007)

`fn_huella_auditoria(p_hasta)` encadena con SHA-256 cada fila de `auditoria` (con su detalle) hasta el id indicado. El trigger de solo inserción no corre si alguien usa `session_replication_role = replica`; la huella no lo impide, pero lo detecta: si una fila se borra o se cambia, la huella ya no coincide. Solo la puede ejecutar la conexión de administración, no el panel.

### 4.4 Cambiar el esquema

1. Crear `supabase/migrations/000N_descripcion.sql` dentro de `BEGIN; ... COMMIT;`. Nunca editar una migración ya aplicada.
2. Escribir su prueba en `supabase/tests/000N_*.sql`, terminando en `ROLLBACK`.
3. `npx supabase db push --dry-run`, luego `npx supabase db push`.
4. Ejecutar todas las pruebas: `npx supabase db query --linked -f supabase/tests/<archivo>.sql`.

### 4.5 Migraciones 0012 y 0013

- **0012** agrega `fn_crear_usuario` y `fn_rut_valido` (dígito verificador módulo 11, la misma regla de `panel/src/lib/rut.ts`). Se aplica antes de desplegar la función `crear-usuario`. Prueba: `supabase/tests/0012_pruebas_alta_usuarios.sql`.
- **0013** es limpieza: borra las vistas `v_*` que nadie consulta (corrían con permisos del dueño y saltaban el RLS), el índice único de nombre que repetía `medicamento_nombre_ci_uk` y quita a `anon` el permiso sobre `fn_rol_actual`. No toca datos.

## 5. Panel web

```
panel/src/
  pages/         pantallas (Resumen, Inventario, Animales, Tratamientos, Alertas, Maestros, Exportar, Auditoría)
  formularios/   formularios de cada operación
  components/    Tabla, Filtros, Dialogo, FormularioDialogo, Vista (carga, vacío y error), Layout
  data/          consultas.ts (lecturas) y ejecutar.ts (llamadas a funciones)
  auth/          sesión y rol del usuario
  lib/           reglas puras con pruebas: vencimiento, RUT, CSV, dosis repetidas, permisos
```

- Cada pantalla se descarga al abrirla (`lazy` en `App.tsx`) y las librerías van en archivos aparte (`vite.config.ts`), para que el inicio sea liviano.
- `npm run lint` revisa el código con ESLint (`eslint.config.js`), con reglas que prohíben `eval`, `innerHTML` y HTML sin escapar.
- Los botones se muestran según el rol (`lib/permisos.ts`), pero quien autoriza es la base de datos.
- `ejecutar()` convierte los errores en mensajes para el usuario: el texto de la función si es una validación, "No tienes permiso" si el rol no alcanza y un mensaje de conexión en cualquier otro caso.
- Exportar genera el archivo en el navegador (CSV con `;` y BOM para Excel, con protección contra fórmulas), calcula el SHA-256 y lo registra antes de descargar.

## 6. Pruebas

| Qué | Comando | Resultado esperado |
|-----|---------|--------------------|
| Funciones puras del panel | `cd panel && npm test` | 31 de 31 |
| Calidad del código del panel | `cd panel && npm run lint` | Sin errores |
| Bot | `cd bot && npm test` | 19 de 19 |
| Base de datos | `npx supabase db query --linked -f supabase/tests/<archivo>.sql` (0001, 0002, 0003, 0005, 0007, 0008, 0010 y 0012) | Cada archivo informa que todas sus pruebas pasan |
| Interfaz | Playwright (ver `pruebas/panel/resultados_e2e.md`) | Todos los casos pasan |
| Carga | GitHub, Actions, carga, Run workflow (`pruebas/carga/carga.k6.js`) | p95 menor a 500 ms y 0 fallas en las 3 corridas |
| Estrés | GitHub, Actions, estres, Run workflow (`pruebas/carga/estres.k6.js`) | Sin fallas con 100, 200 y 400 usuarios |
| Permisos por rol en la interfaz | Iniciar sesión con las cuentas OPERARIO y AUDITOR de prueba | Cada rol ve solo sus pantallas |
| Seguridad | ZAP baseline, `npm audit`, Gitleaks | Sin alertas medias o altas |

Cada push a `main` ejecuta las pruebas del bot y del panel, ESLint, el build, `npm audit` y Gitleaks (`.github/workflows/ci.yml`).

## 7. Despliegue

```bash
# Panel
cd panel && npm run build && npx wrangler deploy

# API del bot
cd bot && npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # y SUPABASE_URL, SUPABASE_ANON_KEY
npx wrangler deploy
```

```bash
# Función de alta de usuarios (después de aplicar la migración 0012)
npx supabase functions deploy crear-usuario
```

La función usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY`, que Supabase inyecta solo; no hay que cargar secretos. La clave de servicio queda en la función y nunca llega al panel. Solo acepta llamadas desde el panel publicado y desde `localhost:5173`; si cambia la dirección del panel, hay que agregarla en `ORIGENES` de `supabase/functions/crear-usuario/index.ts` y volver a desplegar.

Verificación después de desplegar: `/inventario` sin sesión redirige a `/login`; `POST /telegram/webhook` sin secreto responde 403; `POST /importar` sin token responde 401.

## 8. Respaldo y restauración

**Automático.** `.github/workflows/respaldo.yml` corre todos los días a las 04:00 (hora de Chile) y también a mano desde Actions, respaldo, Run workflow. Hace cuatro cosas:

1. Descarga esquema, datos y roles con `supabase db dump`.
2. Los restaura en un contenedor `supabase/postgres` limpio y compara las filas de las 17 tablas con producción (`pruebas/respaldo/contar_filas.sql`). Si no coinciden, falla.
3. Recalcula la huella de auditoría guardada el día anterior. Si cambió, falla: alguien borró o alteró la auditoría.
4. Cifra el respaldo con age y lo guarda 30 días como artefacto `respaldo-cifrado`. La huella nueva queda 90 días como `huella-auditoria`.

Secretos del repositorio: `SUPABASE_DB_URL` (cadena del Session pooler, `aws-1-us-west-2.pooler.supabase.com:5432`, con la contraseña de la base) y `AGE_PUBLIC_KEY`. La clave privada no está en GitHub; la guarda el responsable del equipo. Sin ella los respaldos no se pueden abrir.

**Manual.**

```bash
npx supabase db dump --linked -f esquema.sql
npx supabase db dump --linked --data-only -f datos.sql
npx supabase db dump --linked --role-only -f roles.sql
```

**Restaurar un respaldo cifrado.**

```bash
gh run download <id-de-la-ejecución> -R catitaconflow/moncopullis -n respaldo-cifrado
age -d -i <clave-privada.txt> respaldo-AAAAMMDD.tar.gz.age | tar xzf -
# en el proyecto de destino, en este orden:
psql "<cadena-de-conexión>" -f respaldo/roles.sql
psql "<cadena-de-conexión>" -f respaldo/esquema.sql
psql "<cadena-de-conexión>" -f respaldo/datos.sql
```

Las cuentas de Supabase Auth se restauran solo en un proyecto de Supabase. En un PostgreSQL vacío se restauran las 17 tablas, pero no las cuentas.

## 9. Bot de Telegram

El bot es @moncopulli_registro_bot. El Worker (`bot/src/bot.ts`) recibe los mensajes y llama a las funciones `fn_bot_*` de las migraciones 0008, 0009 y 0010.

| Secreto del Worker | Qué es |
|--------------------|--------|
| `TELEGRAM_BOT_TOKEN` | Token de BotFather. Si se filtra: `/revoke` en BotFather y `npx wrangler secret put TELEGRAM_BOT_TOKEN` |
| `TELEGRAM_WEBHOOK_SECRET` | Lo envía Telegram en cada mensaje; sin él el Worker responde 403 |
| `BOT_CLAVE_DB` | Clave del bot ante la base. La base guarda solo su SHA-256 en `bot_clave` |
| `GEMINI_API_KEY` | Opcional. Sin ella el bot usa un lector simple de texto |

Rotar `BOT_CLAVE_DB`: generar una clave aleatoria (`openssl rand -hex 32`), guardarla con `npx wrangler secret put BOT_CLAVE_DB` y en la base ejecutar `UPDATE bot_clave SET hash = sha256(convert_to('<clave>', 'UTF8'));`. No usar una clave inventada a mano.

Registrar el webhook (después de cambiar el secreto del webhook):

```bash
curl "https://api.telegram.org/bot<token>/setWebhook" -d "url=https://moncopullis-bot.itskay666.workers.dev/telegram/webhook" -d "secret_token=<secreto>"
```

Seguridad del diseño: cada usuario genera su propio código de vinculación desde el panel (botón "Vincular Telegram"), así nadie puede vincular su Telegram a la cuenta de otro. Al confirmar un registro, la base ejecuta las mismas funciones del panel como el usuario vinculado y con origen TELEGRAM. El bot comprueba la vinculación antes de llamar a Gemini.

## 9b. Datos de prueba

`pruebas/datos/datos_falsos.sql` carga registros marcados con `[FALSO]`, solo para una base de pruebas. La base de producción ya tiene datos reales: no se cargan datos de prueba ni se vacían tablas en ella.

## 10. Cuentas de usuario

El ADMIN crea las cuentas desde Maestros, Usuarios, **Nuevo usuario**. El panel llama a la función `crear-usuario`, que:

1. Comprueba que quien llama es ADMIN activo y valida los datos (RUT con dígito verificador, correo, rol, largos).
2. Crea la cuenta en Supabase Auth con una contraseña temporal aleatoria de 14 caracteres, el correo ya confirmado y `debe_cambiar_clave: true` en `user_metadata`.
3. Llama a `fn_crear_usuario` con el JWT del ADMIN, así el permiso se revisa de nuevo en la base y la auditoría queda a su nombre. La función también comprueba que el correo de la cuenta de Auth sea el mismo.
4. Si `fn_crear_usuario` rechaza el alta (RUT o correo repetido, por ejemplo), borra la cuenta de Auth recién creada y devuelve el mensaje.
5. Devuelve la contraseña temporal una sola vez. No se guarda ni se registra en ningún lado.

Mientras `user_metadata.debe_cambiar_clave` sea `true`, el panel solo muestra la pantalla de cambio de contraseña. Al guardarla, el panel llama a `auth.updateUser` con la contraseña nueva y la marca en `false`. La marca va en `user_metadata` porque el usuario no puede modificar `app_metadata`.

Si alguien pierde la contraseña temporal: Supabase → Authentication → Users → la cuenta → enviar recuperación o fijar una contraseña nueva.

Hay dos cuentas de prueba, `operario.prueba@moncopulli.prueba` y `auditor.prueba@moncopulli.prueba`, para probar los permisos de cada rol. Se desactivan antes del piloto.

## 11. Problemas frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| El respaldo falla en "Dump" con "failed to parse connection string" | `SUPABASE_DB_URL` incompleta o con símbolos sin codificar | Volver a cargarla con `gh secret set SUPABASE_DB_URL` usando la cadena completa del Session pooler |
| El respaldo falla en "Verificar la huella" | La auditoría cambió desde el respaldo anterior | Revisar quién tiene la contraseña de la base y comparar con el respaldo del día anterior |
| "Configuración incompleta" al abrir el panel | Falta `.env.local` | Copiar `.env.example` y completar las dos variables |
| "No tienes permiso para esta acción" | El rol no tiene esa operación o la cuenta está inactiva | Revisar el rol en Maestros, Usuarios |
| "Stock insuficiente" al aplicar una dosis | El lote elegido no alcanza | Elegir otro lote o registrar una entrada |
| `db push` responde 403 | La CLI está conectada con otra cuenta | `npx supabase logout` y `npx supabase login` con la cuenta del proyecto |
