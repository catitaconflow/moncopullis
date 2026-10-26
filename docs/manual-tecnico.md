# Manual técnico — Sistema de trazabilidad Moncopulli

Este documento explica cómo está construido el sistema, cómo instalarlo desde cero y cómo mantenerlo.
Los diagramas están en `docs/diagramas/` (archivos `.drawio` editables y `.png`).

## 1. Componentes

| Carpeta | Qué contiene | Tecnología |
|---------|--------------|------------|
| `supabase/migrations/` | Esquema de la base: tablas, restricciones, RLS, triggers y funciones (0001 a 0005) | PostgreSQL 17 en Supabase |
| `supabase/tests/` | Pruebas SQL que terminan en ROLLBACK | SQL |
| `bot/` | Worker de la API: webhook de Telegram e importación | TypeScript, Cloudflare Workers |
| `panel/` | Panel web para administración, operación y auditoría | React 18, Vite, TypeScript |
| `pruebas/` | Carga (JMeter), seguridad (ZAP), datos de prueba y E2E del panel | — |
| `.github/workflows/ci.yml` | Integración continua | GitHub Actions |

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

### 4.1 Reglas que garantiza el motor

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
| `fn_registrar_exportacion(...)` | ADMIN, AUDITOR | Registra la exportación con su SHA-256 |

Las alertas (`STOCK_BAJO`, `VENCIMIENTO_PROXIMO` a 60 días y `DOSIS_ATRASADA`) se recalculan solas después de cada operación que cambia stock o dosis, y se cierran cuando la condición deja de cumplirse.

### 4.3 Cambiar el esquema

1. Crear `supabase/migrations/000N_descripcion.sql` dentro de `BEGIN; ... COMMIT;`. Nunca editar una migración ya aplicada.
2. Escribir su prueba en `supabase/tests/000N_*.sql`, terminando en `ROLLBACK`.
3. `npx supabase db push --dry-run`, luego `npx supabase db push`.
4. Ejecutar todas las pruebas: `npx supabase db query --linked -f supabase/tests/<archivo>.sql`.

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

- Los botones se muestran según el rol (`lib/permisos.ts`), pero quien autoriza es la base de datos.
- `ejecutar()` convierte los errores en mensajes para el usuario: el texto de la función si es una validación, "No tienes permiso" si el rol no alcanza y un mensaje de conexión en cualquier otro caso.
- Exportar genera el archivo en el navegador (CSV con `;` y BOM para Excel, con protección contra fórmulas), calcula el SHA-256 y lo registra antes de descargar.

## 6. Pruebas

| Qué | Comando | Resultado esperado |
|-----|---------|--------------------|
| Funciones puras del panel | `cd panel && npm test` | Todas pasan |
| Bot | `cd bot && npm test` | 19 de 19 |
| Base de datos | `npx supabase db query --linked -f supabase/tests/0005_pruebas_operaciones.sql` | "Pruebas O1 a O20: TODAS PASAN" y "O21 PASA" |
| Interfaz | Playwright (ver `pruebas/panel/resultados_e2e.md`) | Todos los casos pasan |
| Carga | JMeter, `pruebas/carga/plan_carga.jmx` | Ver informe, sección 9 |
| Seguridad | ZAP baseline, `npm audit`, Gitleaks | Sin alertas medias o altas |

Cada push a `main` ejecuta las pruebas del bot y del panel, el build, `npm audit` y Gitleaks (`.github/workflows/ci.yml`).

## 7. Despliegue

```bash
# Panel
cd panel && npm run build && npx wrangler deploy

# API del bot
cd bot && npx wrangler secret put TELEGRAM_WEBHOOK_SECRET   # y SUPABASE_URL, SUPABASE_ANON_KEY
npx wrangler deploy
```

Verificación después de desplegar: `/inventario` sin sesión redirige a `/login`; `POST /telegram/webhook` sin secreto responde 403; `POST /importar` sin token responde 401.

## 8. Datos de prueba

`pruebas/datos/datos_falsos.sql` carga registros marcados con `[FALSO]` y `pruebas/datos/limpiar_datos_falsos.sql` los elimina en orden de dependencias. Se deben limpiar antes de cargar datos reales.

## 9. Cuentas de usuario

1. Crear la cuenta en Supabase → Authentication → Users (correo y contraseña temporal).
2. Insertar su fila en `usuario` con el `auth_user_id` de esa cuenta y el rol.
3. Después, el ADMIN cambia el rol o desactiva la cuenta desde Maestros → Usuarios.

## 10. Problemas frecuentes

| Síntoma | Causa | Solución |
|---------|-------|----------|
| "Configuración incompleta" al abrir el panel | Falta `.env.local` | Copiar `.env.example` y completar las dos variables |
| "No tienes permiso para esta acción" | El rol no tiene esa operación o la cuenta está inactiva | Revisar el rol en Maestros → Usuarios |
| "Stock insuficiente" al aplicar una dosis | El lote elegido no alcanza | Elegir otro lote o registrar una entrada |
| `db push` responde 403 | La CLI está conectada con otra cuenta | `npx supabase logout` y `npx supabase login` con la cuenta del proyecto |
