# Moncopulli: app móvil (Android)

App Android para el trabajo en terreno de la lechería Moncopulli: aplicar las dosis programadas, registrar tratamientos aplicados en el momento, revisar animales y resguardos de leche, y registrar salidas de inventario. Usa la misma base de datos de Supabase que el panel web y el bot de Telegram, y está pensada para seguir funcionando cuando se pierde la señal.

## Contenido

1. [Funciones](#funciones)
2. [Acceso y roles](#acceso-y-roles)
3. [Funcionamiento sin conexión](#funcionamiento-sin-conexión)
4. [Arquitectura](#arquitectura)
5. [Tecnologías y versiones](#tecnologías-y-versiones)
6. [Requisitos en Supabase](#requisitos-en-supabase)
7. [Configuración local](#configuración-local)
8. [Compilar y ejecutar (debug)](#compilar-y-ejecutar-debug)
9. [Generar e instalar la versión release](#generar-e-instalar-la-versión-release)
10. [Pruebas](#pruebas)
11. [Problemas frecuentes](#problemas-frecuentes)
12. [Licencias](#licencias)

## Funciones

La app tiene cinco pestañas en la barra inferior:

| Pestaña | Qué hace |
|---|---|
| **Inicio** | Muestra la fecha de hoy, un resumen ("N por aplicar · M atrasadas") y las dosis programadas hasta hoy, incluidas las atrasadas. Cada dosis se puede **aplicar** (con la hora actual o una elegida; el lote lo elige el servidor por FEFO, primero en vencer, primero en salir) u **omitir** con un motivo. |
| **Animales** | Lista de animales sin baja, con búsqueda por DIIO y filtro de animales **en resguardo de leche** (período en que no se puede vender su leche tras un tratamiento). |
| **Registrar** | Registro en terreno de un tratamiento aplicado en el momento: DIIO, medicamento, cantidad, quién lo indicó, fecha y hora, motivo y observaciones. |
| **Inventario** | Medicamentos activos con su stock y sus lotes vigentes, búsqueda y filtro **bajo mínimo**. Permite **registrar una salida** por ajuste (merma) de un lote: vencido, roto o derramado, conteo físico u otro. |
| **Actividad** | Historial de lo enviado desde este teléfono en los últimos 7 días: enviados, pendientes y rechazados. Permite **enviar ahora**, **volver a enviar** un rechazado o **descartarlo**. |

La barra superior muestra el nombre de la pestaña, un chip de conexión (en línea / sin conexión / "N por enviar"; al tocarlo abre Actividad) y el menú de cuenta para cerrar sesión.

## Acceso y roles

- Se inicia sesión con correo y contraseña de Supabase Auth: las mismas cuentas del panel web.
- Solo pueden entrar usuarios **activos** con rol **ADMIN** u **OPERARIO**. Las funciones del servidor validan lo mismo con `fn_exigir_rol`, así que no basta con saltarse la validación de la app.
- Si la cuenta tiene una **contraseña temporal** (creada desde el panel), la app pide cambiarla primero en el panel web.
- Al **cerrar sesión** se borra del teléfono todo lo de esa cuenta: caché, pendientes y envíos programados. Si hay registros pendientes o rechazados, la app pide confirmar antes, porque se pierden.

## Funcionamiento sin conexión

La app distingue entre **leer** y **escribir**.

**Lectura: primero la red y, de respaldo, la caché.**
- Cada lista (dosis, animales, resguardos, inventario y el perfil del usuario) se guarda en una base local (Room, `cache.db`) cada vez que el servidor responde.
- Si no hay respuesta, se muestra lo último guardado junto con la fecha en que se guardó.
- Si el servidor responde con un error (401, 500…), se muestra el error en vez de datos viejos.
- Al tener red y sesión válida, la app **precarga** todas las listas aunque no se hayan abierto esas pestañas. De las dosis trae también las de los próximos 7 días, para que al día siguiente la app funcione aunque se abra sin señal.

**Escritura: depende de si la operación es idempotente** (repetirla no cambia el resultado).

| Operación | Función en Supabase | Sin conexión |
|---|---|---|
| Aplicar dosis | `fn_app_aplicar_dosis` | Queda en cola y se envía sola |
| Registrar aplicación | `fn_app_registrar_aplicacion` (idempotente por `p_uuid`) | Queda en cola y se envía sola |
| Omitir dosis | `fn_app_omitir_dosis` | **No disponible**: requiere conexión |
| Registrar salida de inventario | `fn_app_registrar_salida` | **No disponible**: requiere conexión |

Las operaciones que pueden esperar usan una cola local (patrón *outbox*, base Room `envios.db`):

1. Con red, se intenta enviar en el momento y el usuario ve el resultado al tiro (lote usado, resguardo o error).
2. Si no hay red o no llega respuesta, se guarda en la cola **con la hora fijada al tocar el botón**. Así el resguardo de leche se calcula con la hora real de aplicación y no con la de sincronización.
3. **WorkManager** (`EnviarPendientesWorker`) envía la cola cuando vuelve la red, aunque la app esté cerrada, con reintentos de espera creciente (30 s, 60 s, 120 s…).
4. Los errores definitivos (por ejemplo, stock insuficiente) quedan como **rechazados** en Actividad. Los pasajeros (sin red, 5xx, sesión vencida) se reintentan solos.

`envios.db` **no** se borra al cambiar su esquema, porque puede tener aplicaciones que aún no llegan al servidor. Si se cambia la tabla `envio`, hay que escribir una `Migration` de Room. En cambio, `cache.db` se recrea vacía si cambia su esquema.

Omitir y registrar salida no son idempotentes: si se reintentara una llamada que sí llegó, se descontaría o registraría dos veces. Por eso solo se hacen con conexión y sin reintentos automáticos.

## Arquitectura

Arquitectura por capas con **MVVM** (Model-View-ViewModel): cada pantalla de Compose observa el estado de su ViewModel, y el ViewModel usa repositorios que hablan con Supabase y con Room. Las dependencias se inyectan con **Hilt**.

```
movil/
├── app/
│   ├── build.gradle.kts              # configuración del módulo (SDK, release, dependencias)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── keepRules/rules.keep      # reglas propias de R8 (hoy no hay ninguna)
│       ├── res/                      # íconos vectoriales, temas, colores y fuentes Nunito
│       └── java/cl/moncopulli/app/
│           ├── MainActivity.kt       # única Activity: edge-to-edge y Compose
│           ├── MoncopulliApp.kt      # Application con Hilt; configura WorkManager
│           ├── di/                   # módulos de Hilt: cliente Supabase y bases Room
│           ├── data/
│           │   ├── auth/             # sesión, perfil y roles
│           │   ├── cache/            # caché de lectura (cache.db) y precarga
│           │   ├── envio/            # outbox (envios.db), worker y clasificación de fallos
│           │   ├── dosis/            # dosis programadas y llamadas fn_app_*
│           │   ├── animal/           # animales y resguardos de leche
│           │   ├── inventario/       # medicamentos, lotes y salidas
│           │   └── red/              # MonitorConexion (estado de la red)
│           └── ui/
│               ├── AppRoot.kt        # decide entre Login, app principal o error
│               ├── login/  sesion/   # inicio de sesión y verificación de perfil
│               ├── navegacion/       # Scaffold, barras, rutas y chip de conexión
│               ├── inicio/  animales/  registrar/  inventario/  actividad/
│               ├── comun/            # componentes compartidos (avisos, fecha y hora, formatos)
│               └── theme/            # colores, tipografía y tema Material 3
├── licencias/Nunito-OFL.txt
└── gradle/libs.versions.toml         # catálogo de versiones
```

La app **no escribe directamente en las tablas**. Lee con PostgREST (protegido por RLS, *Row Level Security*) y escribe solo con funciones `fn_app_*`, que reutilizan las mismas reglas del panel: stock, resguardo, auditoría y alertas. Estas funciones registran el origen `APPMOVIL`.

## Tecnologías y versiones

Versiones tomadas de `gradle/libs.versions.toml` y `app/build.gradle.kts`:

| Componente | Versión |
|---|---|
| Android Gradle Plugin (AGP) | 9.5.1 |
| Gradle (wrapper) | 9.6.0 |
| Kotlin | 2.3.20 |
| KSP | 2.3.12 |
| Compose BOM | 2026.02.01 (Material 3) |
| Navigation Compose | 2.9.7 |
| Lifecycle | 2.11.0 |
| Hilt / AndroidX Hilt | 2.60.1 / 1.4.0 |
| Room | 2.8.5 |
| WorkManager | 2.11.2 |
| kotlinx.serialization | 1.11.0 |
| supabase-kt (Auth y Postgrest) | 3.8.0 |
| Ktor (cliente OkHttp) | 3.5.1 |
| `minSdk` / `targetSdk` / `compileSdk` | 26 (Android 8.0) / 37 / 37 |

El código compila con destino Java 11. Gradle usa el JDK que trae Android Studio.

## Requisitos en Supabase

El proyecto de Supabase al que apunte la app debe tener aplicadas **todas las migraciones hasta la 0015**:

- `supabase/migrations/0014_app_movil.sql`: crea `fn_app_registrar_aplicacion` y `fn_app_aplicar_dosis`.
- `supabase/migrations/0015_origen_app_movil.sql`: agrega el origen `APPMOVIL` y crea `fn_app_omitir_dosis` y `fn_app_registrar_salida`.

Desde la raíz del repositorio, con la CLI enlazada al proyecto correcto:

```bash
npx supabase migration list            # compara lo local con lo aplicado
npx supabase db push --dry-run         # revisa qué se aplicaría
npx supabase db push                   # aplica las pendientes
```

Sus pruebas son `supabase/tests/0014_pruebas_app_movil.sql` y `supabase/tests/0015_pruebas_origen_app.sql`. Cada una corre en una transacción que termina en `ROLLBACK`:

```bash
npx supabase db query --linked -f supabase/tests/0014_pruebas_app_movil.sql
npx supabase db query --linked -f supabase/tests/0015_pruebas_origen_app.sql
```

Si faltan estas migraciones, la app entra y lista datos, pero falla al aplicar, registrar, omitir o registrar salidas porque no encuentra las funciones (error `PGRST202`).

## Configuración local

La URL y la clave del proyecto se leen de **`movil/local.properties`**. Ese archivo está en `.gitignore` y **nunca se sube al repositorio**. Android Studio lo crea al abrir el proyecto, con `sdk.dir`; hay que agregarle dos líneas:

```properties
SUPABASE_URL=https://<REF_DEL_PROYECTO>.supabase.co
SUPABASE_ANON_KEY=<CLAVE_PUBLICA_DEL_PROYECTO>
```

- Los valores están en Supabase → **Project Settings → API**. Usa la clave **anon / publishable**, que es pública por diseño: la protección real de los datos son las políticas RLS.
- **Nunca uses la clave `service_role` / secret.** Queda dentro del APK, cualquiera puede extraerla y salta las RLS.
- Al compilar se copian a `BuildConfig.SUPABASE_URL` y `BuildConfig.SUPABASE_ANON_KEY`. Si faltan, la app se cierra al abrir con el mensaje *"Falta SUPABASE_URL o SUPABASE_ANON_KEY en movil/local.properties"*.
- Después de cambiarlas, sincroniza Gradle (ícono del elefante o **File → Sync Project with Gradle Files**) y vuelve a compilar.

## Compilar y ejecutar (debug)

1. Abre **Android Studio → File → Open** y elige la carpeta **`movil/`**, no la raíz del repositorio.
2. Espera a que termine la sincronización de Gradle (barra inferior). La primera vez descarga dependencias.
3. Conecta el teléfono por USB con la **depuración USB** activada (Ajustes → Opciones de desarrollador) y acepta el diálogo de autorización en el teléfono.
4. Elige el teléfono en el selector de dispositivos y presiona **Run ▶** (configuración `app`).

Para ver registros: **Logcat** con el filtro `package:cl.moncopulli.app`. Las etiquetas propias son `MoncopulliSesion`, `MoncopulliCache` y `MoncopulliEscritura`.

## Generar e instalar la versión release

La release activa R8 con el DSL de AGP 9.3 o superior (`optimization { enable = true }` en `app/build.gradle.kts`). Así se reduce y ofusca el código y se eliminan los recursos sin usar. Las reglas propias de R8 van en archivos `.keep` dentro de `app/src/main/keepRules/`. Hoy no hace falta ninguna, porque las bibliotecas traen las suyas.

### Generar el APK firmado

1. En Android Studio: **Build → Generate Signed App Bundle or APK… → APK**.
2. Elige el keystore (`.jks`), su alias y sus contraseñas. El keystore **se guarda fuera del repositorio**; `*.jks` y `*.keystore` están en `.gitignore`. Si se pierde, no se pueden publicar actualizaciones que se instalen sobre la versión anterior.
3. Variante **release**. En *Destination Folder* deja **`movil/app`**: Studio agrega una subcarpeta con el nombre de la variante.
4. Resultado: `movil/app/release/app-release.apk`, junto con `mapping.txt` (ignorados por git).

Guarda el `mapping.txt` de cada versión que entregues. Sirve para traducir los errores ofuscados de esa compilación (nombres como `a.b.c`) y no se puede regenerar después.

### Instalar en el teléfono

Desde la carpeta `movil/`:

```bash
~/Android/Sdk/platform-tools/adb devices        # el teléfono debe aparecer como "device"
~/Android/Sdk/platform-tools/adb install -r app/release/app-release.apk
```

- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: el teléfono tiene la app firmada con otra clave (por ejemplo, la versión debug). Desinstálala con `adb uninstall cl.moncopulli.app` y vuelve a instalar. **Al desinstalar se pierden los pendientes de la cola**: revisa antes que Actividad no tenga ninguno.
- Para probar el arranque en frío: `adb shell am force-stop cl.moncopulli.app` y abre la app desde su ícono.

Para compartir el APK sin cable: Android 8.0 o superior. Hay que permitir "Instalar apps desconocidas" en la app desde la que se abre el archivo, y Play Protect puede advertir que la app no es reconocida porque no viene de Play Store.

## Pruebas

- **Servidor:** las reglas de negocio que usa la app (roles, idempotencia, stock, resguardo, origen `APPMOVIL`) se prueban en `supabase/tests/0014_*` y `0015_*`. Ver [Requisitos en Supabase](#requisitos-en-supabase).
- **App:** por ahora las pruebas son manuales; `app/src/test` y `app/src/androidTest` solo tienen los ejemplos de la plantilla. Lista mínima antes de entregar una versión, en release y en un teléfono real:
  1. Iniciar sesión como ADMIN y como OPERARIO. Un usuario con otro rol o desactivado no debe poder entrar.
  2. Inicio: aplicar una dosis (ver lote y resguardo) y omitir otra con motivo.
  3. Registrar: registrar una aplicación con un DIIO existente.
  4. Inventario: registrar una salida y ver el stock actualizado.
  5. Activar el **modo avión**: las listas siguen visibles (con la fecha de la caché) y aplicar o registrar queda "por enviar". Los botones **Omitir** y **Registrar salida** aparecen deshabilitados.
  6. Quitar el modo avión: los pendientes se envían solos y Actividad los muestra como enviados.
  7. Cerrar sesión con pendientes o rechazados: la app debe pedir confirmación.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| La app se cierra al abrir | Falta `SUPABASE_URL` o `SUPABASE_ANON_KEY` | Completar `movil/local.properties`, sincronizar Gradle y recompilar |
| "Tu rol no tiene acceso a la app móvil" | El usuario no es ADMIN ni OPERARIO | Cambiar el rol desde el panel |
| "Entraste con una contraseña temporal…" | Cuenta creada desde el panel | Cambiar la contraseña en el panel web y volver a entrar |
| Error `PGRST202` al aplicar, registrar u omitir | Faltan las migraciones 0014 y 0015 en ese proyecto | Aplicarlas (ver [Requisitos en Supabase](#requisitos-en-supabase)) |
| Un envío queda "rechazado" en Actividad | El servidor lo rechazó con un error definitivo (p. ej. sin stock) | Leer el motivo; corregir el dato en el panel y **Volver a enviar**, o **Descartar** |
| Pendientes que no salen | Sin red o sesión vencida | Abrir la app con internet (renueva la sesión) o tocar **Enviar ahora** en Actividad |
| Tras instalar se ve una versión vieja | Se instaló otro APK | Revisar la ruta y la fecha del APK; ver [Generar el APK firmado](#generar-el-apk-firmado) |
| El ícono nuevo no aparece | El launcher guarda el ícono anterior en caché | Reiniciar el teléfono |

## Licencias

- Fuente **Nunito** (pesos SemiBold y Bold, en `app/src/main/res/font/`): SIL Open Font License 1.1. El texto completo está en `licencias/Nunito-OFL.txt`.
- Las bibliotecas de terceros se distribuyen bajo sus propias licencias (principalmente Apache 2.0).
