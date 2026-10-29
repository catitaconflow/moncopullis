# Moncopulli

Sistema de trazabilidad sanitaria e inventario de medicamentos: base de datos en Supabase (PostgreSQL), panel web y bot de Telegram en Cloudflare Workers.

## Estructura

- `supabase/migrations/`: esquema por migraciones ordenadas (0001 a 0013).
- `supabase/tests/`: pruebas SQL. Cada archivo corre dentro de una transacción y termina en `ROLLBACK`.
- `supabase/functions/crear-usuario/`: alta de usuarios desde el panel.
- `panel/`: panel web (React y Vite) publicado en Cloudflare Workers.
- `bot/`: Worker del webhook de Telegram y del endpoint de importación. Pruebas con `node --test`.
- `docs/`: manual de usuario, manual técnico, modelo de datos y diagramas.

## Requisitos

- Node.js 20 o superior.
- Cuenta de Supabase y acceso al proyecto.
- Cuenta de Cloudflare con Wrangler.

## Base de datos

```bash
npx supabase login
npx supabase link --project-ref <REF_DEL_PROYECTO>   # pide la contraseña de la BD
npx supabase migration list                          # estado local vs remoto
npx supabase db push --dry-run                       # revisa qué aplicaría
npx supabase db push                                 # aplica las pendientes
```

Pruebas: ejecutar el archivo de `supabase/tests/` correspondiente en el SQL Editor, o con `npx supabase db query --linked -f supabase/tests/0003_pruebas_importacion.sql`.

> Si una base ya tiene objetos creados a mano, no ejecutes `db push` sin revisar primero. Para registrar migraciones ya aplicadas: `npx supabase migration repair --status applied <versión>`.

## Bot (Cloudflare Worker)

```bash
cd bot
npm test
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler deploy
```

Los secretos nunca van en el repositorio ni en `wrangler.toml`. El Worker usa un Durable Object (`RegistroUpdatesDO`) para deduplicar updates de Telegram.

## Variables y secretos

| Nombre | Dónde se guarda | Uso |
|---|---|---|
| `TELEGRAM_WEBHOOK_SECRET` | `wrangler secret` | Verifica que el webhook venga de Telegram |
| `SUPABASE_URL` | `wrangler secret` | URL del proyecto |
| `SUPABASE_ANON_KEY` | `wrangler secret` | Clave pública; la autorización real está en RLS |

## Seguridad

- RLS activo en todas las tablas públicas.
- Las bajas son lógicas; las tablas de auditoría e importación son de solo inserción.
- La importación solo la puede ejecutar un usuario con rol ADMIN.
