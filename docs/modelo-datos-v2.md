# Modelo de datos v2 de Agrícola Moncopulli

Motor: PostgreSQL en Supabase. Acceso desde Cloudflare Workers (API) y panel web (Cloudflare Pages).
Autenticación: Supabase Auth (`auth.users`). Estado: **en creación / integración; no probado ni entregado.**

## 1. Convención de cardinalidad (única en todo el proyecto)

Cada extremo de una relación muestra **cuántas instancias de esa entidad se relacionan con una instancia de la otra**.
Ejemplo: `propietario 0..1 ——— 0..* animal` significa: un animal tiene 0 o 1 propietario, y un propietario tiene 0 o muchos animales.

Notación en diagramas: crow's foot de draw.io (`ERzeroToOne`, `ERmandOne`, `ERzeroToMany`, `ERoneToMany`).

## 2. Tablas

Convención de nombres: tablas y columnas en minúscula; `id` = `bigint identity`; `uuid` = generado en el cliente para idempotencia; fechas con hora = `timestamptz` (UTC).

| Tabla | Columnas clave | Restricciones |
|---|---|---|
| **usuario** | id PK; auth_user_id uuid **UK NOT NULL** → auth.users; rut varchar(10) UK; nombres; apellidos; email varchar(254) UK (en minúscula); telefono; rol varchar(10) (ADMIN, OPERARIO, AUDITOR); activo bool; intentos_fallidos smallint ≥0; bloqueado_hasta timestamptz NULL; telegram_user_id bigint UK NULL; telegram_codigo_hash varchar(128) NULL; telegram_codigo_expira timestamptz NULL; telegram_codigo_intentos smallint ≥0 default 0; fecha_creacion; ultimo_acceso | No hay `password_hash` (lo gestiona Supabase Auth). RUT con dígito verificador. |
| **propietario** | id PK; rut UK; nombre_completo varchar(120); telefono; activo | Solo para animales arrendados. |
| **animal** | id PK; diio char(9) UK NULL (solo dígitos); categoria (VACA, VAQUILLA, TERNERO, TORO); estado_productivo (LACTANCIA, SECA) NULL; propietario_id FK NULL; fecha_nacimiento date; fecha_baja date NULL; motivo_baja (VENTA, MUERTE, DEVOLUCION) NULL; observaciones; fecha_creacion | estado_productivo solo si categoria = VACA. DEVOLUCION solo si propietario_id no es nulo. Baja completa: fecha y motivo juntos. |
| **proveedor** | id PK; rut UK; razon_social; nombre_contacto; telefono; email; activo | Se desactiva, no se borra. |
| **medicamento** | id PK; nombre_comercial UK (sin distinguir mayúsculas); principio_activo; tipo; via_administracion; unidad_base (ML, G, UNIDAD); contenido_envase numeric(10,2) > 0; requiere_receta bool; resguardo_leche_dias smallint 0..365; stock_minimo numeric(12,2) ≥ 0; stock_actual numeric(12,2) ≥ 0 (mantenido por trigger = suma de lotes); activo | stock_actual nunca se escribe desde la aplicación. |
| **lote** | id PK; medicamento_id FK NOT NULL; numero_lote varchar(40); fecha_vencimiento date NOT NULL; stock_lote numeric(12,2) ≥ 0; activo; fecha_creacion | UK (medicamento_id, numero_lote). Stock por lote, mantenido por trigger. |
| **tratamiento** | id PK; uuid UK; animal_id FK NOT NULL; indicado_por varchar(120) (veterinario externo, no usuario); numero_receta varchar(40) NULL; motivo varchar(200); observaciones; creado_por FK NOT NULL → usuario; fecha_creacion; fecha_anulacion NULL; motivo_anulacion varchar(300) NULL | Anular con motivo; nunca borrar. |
| **dosis** | id PK; uuid UK; tratamiento_id FK NOT NULL; medicamento_id FK NOT NULL; lote_id FK NULL; cantidad numeric(10,2) > 0 (unidad base); estado (PROGRAMADA, APLICADA, OMITIDA, ANULADA); fecha_programada NULL; fecha_aplicada NULL; aplicado_por FK NULL → usuario; origen (WEBAPP, TELEGRAM); fin_resguardo_leche timestamptz NULL; motivo_estado varchar(300) NULL; fecha_registro | APLICADA ⇒ fecha_aplicada, aplicado_por, lote_id y origen obligatorios. OMITIDA/ANULADA ⇒ motivo. UK (id, medicamento_id) para la FK compuesta de movimientos. |
| **movimiento_inventario** | id PK; uuid UK; medicamento_id FK NOT NULL; lote_id FK NOT NULL; tipo (ENTRADA, SALIDA_DOSIS, REVERSA_DOSIS, SALIDA_AJUSTE, ENTRADA_AJUSTE); cantidad numeric(12,2) > 0; proveedor_id FK NULL; dosis_id FK NULL; motivo (VENCIDO, ROTO_DERRAME, CONTEO, OTRO) NULL; observaciones; usuario_id FK NOT NULL; origen (WEBAPP, TELEGRAM); fecha_evento; fecha_registro | proveedor solo en ENTRADA. dosis solo en SALIDA_DOSIS/REVERSA_DOSIS. motivo obligatorio en AJUSTE. FK compuesta (dosis_id, medicamento_id) → dosis(id, medicamento_id). Inmutable (sin UPDATE ni DELETE). Índice único parcial: una SALIDA_DOSIS y una REVERSA_DOSIS por dosis. |
| **mensaje_bot** | id PK; telegram_update_id bigint UK; telegram_chat_id bigint; telegram_from_id bigint; usuario_id FK NULL; texto text NULL (se borra a los 30 días); intencion (REGISTRAR_TRATAMIENTO, REGISTRAR_MOVIMIENTO, CONSULTA) NULL; animal_diio_propuesto char(9) NULL; medicamento_id FK NULL; cantidad_propuesta numeric(10,2) NULL; fecha_propuesta timestamptz NULL; estado (RECIBIDO, CONFIRMADO, CANCELADO, ERROR); dosis_id FK NULL UK; detalle_error varchar(300); fecha_recepcion; fecha_respuesta NULL | Un mensaje confirmado genera como máximo una dosis. |
| **alerta** | id PK; tipo (STOCK_BAJO, VENCIMIENTO_PROXIMO, STOCK_PENDIENTE, DOSIS_ATRASADA, RECETA_PENDIENTE, DOSIS_APLICADA_TRAS_ANULAR); medicamento_id FK NULL; lote_id FK NULL; dosis_id FK NULL; tratamiento_id FK NULL; estado (ABIERTA, RESUELTA); fecha_creacion; fecha_notificacion NULL; fecha_resolucion NULL; resuelta_por FK NULL → usuario; comentario | CHECK: cada tipo referencia exactamente la entidad que le corresponde. Una sola alerta ABIERTA por tipo y objeto (índice único parcial). |
| **auditoria** | id PK; usuario_id FK NULL → usuario; accion (LOGIN_OK, LOGIN_FALLIDO, CREAR, MODIFICAR, DAR_DE_BAJA, ANULAR, ...); entidad varchar(40); entidad_id bigint NULL; origen (WEBAPP, TELEGRAM, SISTEMA); ip inet NULL; descripcion; fecha timestamptz | Solo inserción (trigger que rechaza UPDATE/DELETE). Índices (entidad, entidad_id) y (usuario_id, fecha). |
| **auditoria_detalle** | id PK; auditoria_id FK NOT NULL; campo varchar(60); valor_anterior text NULL; valor_nuevo text NULL | Solo inserción. Un registro por campo modificado. |
| **intercambio** | id PK; uuid UK; usuario_id FK NOT NULL → usuario; tipo (EXPORTACION, IMPORTACION); alcance varchar(40) (nombre de tabla o COMPLETO); formato (CSV, JSON); filas integer ≥ 0; sha256 char(64) NULL; resultado (OK, RECHAZADO); fecha timestamptz | Solo inserción. Registra cada exportación e importación de datos. |

## 3. Relaciones (cardinalidad en ambos extremos)

Formato: `A [marca de A] — [marca de B] B`. La marca de A indica cuántas A se relacionan con un B.

| # | Relación | Lado A (cuántos A por B) | Lado B (cuántos B por A) | FK |
|---|---|---|---|---|
| R1 | propietario — animal | 0..1 propietario por animal → ZeroToOne en propietario | 0..* animales por propietario → ZeroToMany en animal | animal.propietario_id |
| R2 | animal — tratamiento | 1 animal por tratamiento → One en animal | 0..* tratamientos por animal → ZeroToMany | tratamiento.animal_id |
| R3 | tratamiento — dosis | 1 tratamiento por dosis → One | 1..* dosis por tratamiento → OneToMany | dosis.tratamiento_id |
| R4 | medicamento — dosis | 1 medicamento por dosis → One | 0..* dosis por medicamento → ZeroToMany | dosis.medicamento_id |
| R5 | medicamento — lote | 1 medicamento por lote → One | 0..* lotes por medicamento → ZeroToMany | lote.medicamento_id |
| R6 | lote — dosis | 0..1 lote por dosis → ZeroToOne (obligatorio al aplicar) | 0..* dosis por lote → ZeroToMany | dosis.lote_id |
| R7 | lote — movimiento | 1 lote por movimiento → One | 0..* movimientos por lote → ZeroToMany | movimiento.lote_id |
| R8 | medicamento — movimiento | 1 medicamento por movimiento → One | 0..* movimientos por medicamento → ZeroToMany | movimiento.medicamento_id |
| R9 | proveedor — movimiento | 0..1 proveedor por movimiento (solo ENTRADA) → ZeroToOne | 0..* movimientos por proveedor → ZeroToMany | movimiento.proveedor_id |
| R10 | dosis — movimiento | 0..1 dosis por movimiento (solo salidas y reversas) → ZeroToOne | 0..2 movimientos por dosis (SALIDA y REVERSA) → ZeroToMany con regla de máximo 2 | movimiento.dosis_id |
| R11 | usuario — tratamiento | 1 usuario (creado_por) → One | 0..* tratamientos por usuario → ZeroToMany | tratamiento.creado_por |
| R12 | usuario — dosis | 0..1 usuario (aplicado_por) → ZeroToOne | 0..* dosis por usuario → ZeroToMany | dosis.aplicado_por |
| R13 | usuario — movimiento | 1 usuario por movimiento → One | 0..* movimientos por usuario → ZeroToMany | movimiento.usuario_id |
| R14 | usuario — mensaje_bot | 0..1 usuario por mensaje → ZeroToOne | 0..* mensajes por usuario → ZeroToMany | mensaje_bot.usuario_id |
| R15 | medicamento — mensaje_bot | 0..1 medicamento por mensaje → ZeroToOne | 0..* mensajes por medicamento → ZeroToMany | mensaje_bot.medicamento_id |
| R16 | dosis — mensaje_bot | 0..1 mensaje por dosis → ZeroToOne | 0..1 dosis por mensaje → ZeroToOne | mensaje_bot.dosis_id (UK) |
| R17 | usuario — auditoria | 0..1 usuario por registro → ZeroToOne (acciones del sistema y login fallido) | 0..* registros por usuario → ZeroToMany | auditoria.usuario_id |
| R18 | auditoria — auditoria_detalle | 1 auditoria por detalle → One | 0..* detalles por auditoria → ZeroToMany | auditoria_detalle.auditoria_id |
| R19 | medicamento — alerta | 0..1 medicamento por alerta → ZeroToOne | 0..* alertas por medicamento → ZeroToMany | alerta.medicamento_id |
| R20 | lote — alerta | 0..1 lote por alerta → ZeroToOne | 0..* alertas por lote → ZeroToMany | alerta.lote_id |
| R21 | dosis — alerta | 0..1 dosis por alerta → ZeroToOne | 0..* alertas por dosis → ZeroToMany | alerta.dosis_id |
| R22 | tratamiento — alerta | 0..1 tratamiento por alerta → ZeroToOne | 0..* alertas por tratamiento → ZeroToMany | alerta.tratamiento_id |
| R23 | usuario — alerta | 0..1 usuario (resuelta_por) → ZeroToOne | 0..* alertas por usuario → ZeroToMany | alerta.resuelta_por |
| R24 | usuario — intercambio | 0..1 usuario por intercambio → ZeroToOne | 0..* intercambios por usuario → ZeroToMany | intercambio.usuario_id |

## 4. Cambios respecto al modelo.pdf original

1. **Lote**: se agrega la tabla `lote`; `movimiento_inventario.lote_id` y `dosis.lote_id` (decisión tomada).
2. **Autenticación**: se elimina `password_hash`; `usuario.auth_user_id` enlaza con Supabase Auth. El bloqueo de 5 intentos se aplica en la API (Worker), que cuenta fallos en `intentos_fallidos`.
3. **Merma**: no se elimina. Se unifica como `SALIDA_AJUSTE` con motivo `VENCIDO` o `ROTO_DERRAME`. Justificación: una merma es una salida real de stock y sin registrarla el inventario queda sobrestimado; además es evidencia para SAG.
4. **Tipos de movimiento**: se agrega `ENTRADA_AJUSTE` para correcciones de conteo positivas, manteniendo la regla "cantidad siempre positiva".
5. **Cardinalidades**: se corrigen las filas invertidas de la tabla original (proveedor, dosis, usuario, propietario, alerta). `dosis → movimiento` pasa de 0..1:N a 0..2.
6. **Relaciones faltantes en la tabla original**: usuario–mensaje_bot, medicamento–mensaje_bot, usuario–alerta, tratamiento–alerta, lote–alerta.
7. **mensaje_bot**: se agrega `animal_diio_propuesto` para que la confirmación muestre el animal interpretado, y `telegram_chat_id`.
8. **Nulabilidad**: se declara en cada columna (antes no estaba documentado).
9. **Vinculación Telegram**: `telegram_codigo_intentos` para invalidar el código tras 3 intentos.
10. **Datos personales**: `auditoria.ip` y `mensaje_bot.texto` tienen plazo de retención (30 días para el texto del bot); verificar el alcance de la Ley 21.719 antes de la entrega.

## 5. Exportación, importación y auditoría

- **Exportar**: ADMIN exporta cualquier tabla o el conjunto completo (CSV por tabla o JSON único). AUDITOR exporta solo tablas de consulta (auditoria, auditoria_detalle, movimiento_inventario, tratamiento, dosis, alerta).
- **Importar**: solo ADMIN. Se carga en una tabla de preparación, se valida (tipos, FK, CHECK, UK), se muestra un informe y solo después se confirma. Todo o nada, en una transacción.
- **Idempotencia**: el uuid de cada fila decide si se actualiza u omite; repetir una importación no duplica datos.
- **Trazabilidad**: cada exportación e importación crea una fila en `intercambio` y una entrada EXPORTAR o IMPORTAR en `auditoria`.
- **Seguridad**: la exportación nunca incluye hashes de contraseña ni códigos de vinculación (la contraseña la gestiona Supabase Auth).

## 6. Implementación

- DDL: `supabase/migrations/0001_modelo_v2.sql` (14 tablas, 67 sentencias, 7 triggers, 3 vistas, políticas RLS por rol).
- Validación: sintaxis verificada con `pglast`. **No ejecutada todavía contra una base PostgreSQL ni en Supabase.** Pendiente: `supabase db push` en el proyecto de prueba.
- Reglas de la API (no del motor): permisos por rol, dosis con salida de stock, reversas, alertas de stock pendiente y bloqueo de intentos.

## 7. Decisiones pendientes

- **Stock insuficiente**: el DDL rechaza la salida si el lote no alcanza (CHECK `stock_lote >= 0`). El modelo original permitía guardar la dosis y abrir alerta STOCK_PENDIENTE. Hay que decidir una regla y ajustar el DDL.

## 8. Preguntas abiertas

- Formato oficial del DIIO (9 dígitos según el modelo original). Verificar con SAG antes de fijar el CHECK.
- Si el DIIO es obligatorio o opcional para animales propios.
