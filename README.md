# Moncopulli

Sistema de trazabilidad sanitaria e inventario de medicamentos para la lechería Moncopulli. Incluye una base de datos PostgreSQL en Supabase, un panel web, una app Android para el trabajo en terreno y un bot de Telegram.

## Componentes

- `supabase/migrations/`: esquema y reglas de negocio, migraciones 0001 a 0016 (todas aplicadas en producción).
- `supabase/tests/`: pruebas SQL transaccionales; cada archivo termina en `ROLLBACK`.
- `supabase/functions/crear-usuario/`: alta de usuarios desde el panel web.
- `panel/`: panel de administración, operación y auditoría (React, TypeScript y Vite).
- `movil/`: aplicación Android nativa (Kotlin y Jetpack Compose), con caché y cola de envíos para trabajar sin señal.
- `bot/`: Cloudflare Worker para Telegram y el endpoint de importación.
- `docs/`: manuales técnicos y de usuario, modelo de datos y diagramas.

## Requisitos

- Node.js 20 o superior para el panel y el bot.
- JDK 25 y Android 17 SDK Platform 37.0 (canary) para compilar la app Android.
- Acceso al proyecto Supabase para aplicar migraciones y usar el sistema.
- Cuenta de Cloudflare con Wrangler para desplegar el panel o el bot.

## Base de datos

Revisa primero el estado y el plan de cambios antes de aplicar migraciones:

```bash
npx supabase login
npx supabase link --project-ref <REF_DEL_PROYECTO>
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Las migraciones 0014 y 0015 agregan funciones y el origen de las operaciones desde Android; la 0016 cierra el acceso por la API a las funciones de trigger. Para probarlas en el proyecto enlazado:

```bash
npx supabase db query --linked -f supabase/tests/0014_pruebas_app_movil.sql
npx supabase db query --linked -f supabase/tests/0015_pruebas_origen_app.sql
npx supabase db query --linked -f supabase/tests/0016_pruebas_funciones_trigger.sql
```

Las pruebas SQL se ejecutan dentro de una transacción que termina en `ROLLBACK`. Si una base tiene objetos creados manualmente, no ejecutes `db push` sin revisar antes qué aplicaría.

## Panel web

```bash
cd panel
npm ci
cp .env.example .env.local
npm run dev
```

Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `panel/.env.local`. Nunca uses la clave `service_role` en el navegador.

## App Android

Abre la carpeta `movil/` en Android Studio. Instala Android SDK Platform 37.0 desde el canal Canary. Completa `movil/local.properties` con la URL de Supabase y la clave pública `anon`; `movil/local.properties.example` muestra el formato. Android Studio añade allí la ruta local del SDK.

Ese archivo local está ignorado por Git y no se debe subir. La clave `anon` se incluye en la app y su acceso queda limitado por Auth y RLS. Nunca uses `service_role`.

Desde la carpeta `movil/`, ejecuta las pruebas unitarias y compila el APK de depuración:

```bash
./gradlew --no-daemon testDebugUnitTest assembleDebug
```

En Windows usa `gradlew.bat` en lugar de `./gradlew`. La app necesita que Supabase tenga aplicadas las migraciones hasta 0015 para completar sus operaciones. Los pasos de instalación, configuración y release están en [`movil/README.md`](movil/README.md). Para verla en Windows sin teléfono Android, usa `movil/emulador/INICIAR_EMULADOR.bat` (instrucciones en `movil/emulador/LEEME.txt`).

## Bot de Telegram

```bash
cd bot
npm ci
npm test
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

Los secretos del Worker se guardan con Wrangler y nunca en el repositorio ni en `wrangler.toml`.

## Integración continua y seguridad

`.github/workflows/ci.yml` ejecuta las pruebas del bot y del panel, verifica el panel, ejecuta las pruebas unitarias Android y compila `assembleDebug`. El build Android no necesita credenciales de Supabase y no despliega la aplicación.

- RLS está activo en las tablas públicas; las escrituras pasan por funciones que validan roles.
- Las bajas son lógicas y las tablas de auditoría e importación son de solo inserción.
- Solo un usuario ADMIN puede importar datos.
- No subas `service_role`, contraseñas, keystores ni `movil/local.properties`.
