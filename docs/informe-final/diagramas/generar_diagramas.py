# Genera los diagramas del informe final con Graphviz (dot -> PNG 200 dpi).
import subprocess, pathlib

OUT = pathlib.Path(__file__).parent / "png"
OUT.mkdir(exist_ok=True)

VERDE = "#2f6b3a"; VERDE_CL = "#e6f0e3"; CREMA = "#f7f5ef"; GRIS = "#5b6157"
AZUL = "#2c5d8a"; AZUL_CL = "#e3edf6"; NAR = "#b5651d"; NAR_CL = "#fbeedd"; ROJO = "#a33a2c"; ROJO_CL = "#f8e3df"
FONT = "DejaVu Sans"

BASE = f'''graph [fontname="{FONT}", bgcolor="white", pad="0.3", nodesep="0.45", ranksep="0.6", dpi=200];
node [fontname="{FONT}", fontsize=11];
edge [fontname="{FONT}", fontsize=9, color="{GRIS}", fontcolor="{GRIS}"];'''


def render(nombre, cuerpo, tipo="digraph"):
    src = f"{tipo} G {{\n{BASE}\n{cuerpo}\n}}"
    (OUT.parent / f"{nombre}.dot").write_text(src, encoding="utf-8")
    subprocess.run(["dot", "-Tpng", "-o", str(OUT / f"{nombre}.png")], input=src.encode(), check=True)


# ---------------------------------------------------------------- Esquema real (Supabase, 18-11-2026)
T = {
 "usuario": ["id PK", "auth_user_id UK FK", "rut UK", "nombres", "apellidos", "email UK", "telefono", "rol", "activo", "intentos_fallidos", "bloqueado_hasta", "telegram_user_id UK", "telegram_codigo_hash", "telegram_codigo_expira", "telegram_codigo_intentos", "fecha_creacion", "ultimo_acceso"],
 "propietario": ["id PK", "rut UK", "nombre_completo", "telefono", "activo"],
 "proveedor": ["id PK", "rut UK", "razon_social", "nombre_contacto", "telefono", "email", "activo"],
 "animal": ["id PK", "diio UK", "categoria", "estado_productivo", "propietario_id FK", "madre_id FK", "fecha_nacimiento", "origen_ingreso", "fecha_baja", "motivo_baja", "observaciones", "fecha_creacion"],
 "medicamento": ["id PK", "nombre_comercial UK", "principio_activo", "tipo", "via_administracion", "unidad_base", "contenido_envase", "requiere_receta", "resguardo_leche_dias", "stock_minimo", "stock_actual", "activo"],
 "lote": ["id PK", "medicamento_id FK", "numero_lote", "fecha_vencimiento", "stock_lote", "activo", "fecha_creacion"],
 "tratamiento": ["id PK", "uuid UK", "animal_id FK", "indicado_por", "numero_receta", "motivo", "observaciones", "creado_por FK", "fecha_creacion", "fecha_anulacion", "motivo_anulacion"],
 "dosis": ["id PK", "uuid UK", "tratamiento_id FK", "medicamento_id FK", "lote_id FK", "cantidad", "estado", "fecha_programada", "fecha_aplicada", "aplicado_por FK", "origen", "fin_resguardo_leche", "motivo_estado", "fecha_registro"],
 "movimiento_inventario": ["id PK", "uuid UK", "medicamento_id FK", "lote_id FK", "tipo", "cantidad", "proveedor_id FK", "dosis_id FK", "motivo", "observaciones", "usuario_id FK", "origen", "fecha_evento", "fecha_registro"],
 "mensaje_bot": ["id PK", "telegram_update_id UK", "telegram_chat_id", "telegram_from_id", "usuario_id FK", "texto", "intencion", "animal_diio_propuesto", "medicamento_id FK", "cantidad_propuesta", "fecha_propuesta", "estado", "dosis_id UK FK", "detalle_error", "fecha_recepcion", "fecha_respuesta"],
 "alerta": ["id PK", "tipo", "medicamento_id FK", "lote_id FK", "dosis_id FK", "tratamiento_id FK", "estado", "fecha_creacion", "fecha_notificacion", "fecha_resolucion", "resuelta_por FK", "comentario"],
 "auditoria": ["id PK", "usuario_id FK", "accion", "entidad", "entidad_id", "origen", "ip", "descripcion", "fecha"],
 "auditoria_detalle": ["id PK", "auditoria_id FK", "campo", "valor_anterior", "valor_nuevo"],
 "intercambio": ["id PK", "uuid UK", "usuario_id FK", "tipo", "alcance", "formato", "filas", "sha256", "resultado", "fecha"],
 "documento_veterinario": ["id PK", "uuid UK", "animal_id FK", "tratamiento_id FK", "usuario_id FK", "ruta_almacenamiento UK", "nombre_original", "tipo", "origen", "fecha_subida"],
 "importacion": ["id PK", "export_id UK", "usuario_id FK", "cantidad_registros", "fecha"],
 "importacion_registro": ["id PK", "importacion_id FK", "uuid", "entidad", "datos (jsonb)"],
 "bot_clave": ["id PK", "hash (SHA-256)"],
}
# (hija, columna, madre, cardinalidad junto a la madre, junto a la hija)
FK = [
 ("animal", "propietario_id", "propietario", "0..1", "0..*"),
 ("animal", "madre_id", "animal", "0..1", "0..*"),
 ("lote", "medicamento_id", "medicamento", "1", "0..*"),
 ("tratamiento", "animal_id", "animal", "1", "0..*"),
 ("tratamiento", "creado_por", "usuario", "1", "0..*"),
 ("dosis", "tratamiento_id", "tratamiento", "1", "1..*"),
 ("dosis", "medicamento_id", "medicamento", "1", "0..*"),
 ("dosis", "lote_id", "lote", "0..1", "0..*"),
 ("dosis", "aplicado_por", "usuario", "0..1", "0..*"),
 ("movimiento_inventario", "lote_id", "lote", "1", "0..*"),
 ("movimiento_inventario", "medicamento_id", "medicamento", "1", "0..*"),
 ("movimiento_inventario", "proveedor_id", "proveedor", "0..1", "0..*"),
 ("movimiento_inventario", "dosis_id", "dosis", "0..1", "0..2"),
 ("movimiento_inventario", "usuario_id", "usuario", "1", "0..*"),
 ("mensaje_bot", "usuario_id", "usuario", "0..1", "0..*"),
 ("mensaje_bot", "medicamento_id", "medicamento", "0..1", "0..*"),
 ("mensaje_bot", "dosis_id", "dosis", "0..1", "0..1"),
 ("alerta", "medicamento_id", "medicamento", "0..1", "0..*"),
 ("alerta", "lote_id", "lote", "0..1", "0..*"),
 ("alerta", "dosis_id", "dosis", "0..1", "0..*"),
 ("alerta", "tratamiento_id", "tratamiento", "0..1", "0..*"),
 ("alerta", "resuelta_por", "usuario", "0..1", "0..*"),
 ("auditoria", "usuario_id", "usuario", "0..1", "0..*"),
 ("auditoria_detalle", "auditoria_id", "auditoria", "1", "0..*"),
 ("intercambio", "usuario_id", "usuario", "1", "0..*"),
 ("documento_veterinario", "animal_id", "animal", "0..1", "0..*"),
 ("documento_veterinario", "tratamiento_id", "tratamiento", "0..1", "0..*"),
 ("documento_veterinario", "usuario_id", "usuario", "1", "0..*"),
 ("importacion", "usuario_id", "usuario", "1", "0..*"),
 ("importacion_registro", "importacion_id", "importacion", "1", "0..*"),
]
AREA = {
 "Sanitario": (VERDE, VERDE_CL, ["animal", "propietario", "tratamiento", "dosis", "documento_veterinario"]),
 "Inventario": (AZUL, AZUL_CL, ["medicamento", "lote", "movimiento_inventario", "proveedor", "alerta"]),
 "Usuarios, bot y auditoría": (NAR, NAR_CL, ["usuario", "mensaje_bot", "bot_clave", "auditoria", "auditoria_detalle"]),
 "Intercambio de datos": (GRIS, "#eeeeea", ["intercambio", "importacion", "importacion_registro"]),
}
COLOR = {t: (c, cl) for _, (c, cl, ts) in AREA.items() for t in ts}


def tabla(t, cols=None, ancho=None):
    c, cl = COLOR[t]
    cols = T[t] if cols is None else cols
    filas = []
    for col in cols:
        nom = col.split(" ")[0]
        tags = " ".join(x for x in col.split(" ")[1:])
        icon = ""
        if "PK" in tags: icon = "🔑 "
        elif "FK" in tags: icon = "↗ "
        estilo = f'<b>{nom}</b>' if "PK" in tags else nom
        tag = f'<font color="{GRIS}" point-size="8"> {tags}</font>' if tags else ""
        filas.append(f'<tr><td port="{nom}" align="left" bgcolor="white">{icon}{estilo}{tag}</td></tr>')
    return (f'"{t}" [shape=plain, label=<<table border="1" cellborder="0" cellspacing="0" cellpadding="4" color="{c}">'
            f'<tr><td bgcolor="{c}"><font color="white"><b>{t}</b></font></td></tr>{"".join(filas)}</table>>];')


def er(nombre, tablas, titulo, completo=True, rankdir="LR"):
    cuerpo = [f'rankdir={rankdir}; label=<<b>{titulo}</b>>; labelloc=t; fontsize=16; splines=spline; nodesep=0.35; ranksep=0.9;']
    for t in tablas:
        if completo:
            cuerpo.append(tabla(t))
        else:
            claves = [x for x in T[t] if ("PK" in x or "FK" in x or "UK" in x)]
            cuerpo.append(tabla(t, claves))
    for h, col, m, cm, ch in FK:
        if h in tablas and m in tablas:
            cuerpo.append(f'"{m}":id -> "{h}":{col} [dir=both, arrowtail=none, arrowhead=none, taillabel="{cm}", headlabel="{ch}", labeldistance=1.6, color="{COLOR[h][0]}"];')
    render(nombre, "\n".join(cuerpo))


# ER general: solo claves, todas las tablas
er("er_general", list(T), "Modelo de datos completo en Supabase (18 tablas, 30 relaciones)", completo=False)
er("er_sanitario", ["propietario", "animal", "tratamiento", "dosis", "documento_veterinario", "medicamento", "lote", "usuario"], "ER 1 · Animales, tratamientos y dosis")
er("er_inventario", ["proveedor", "medicamento", "lote", "movimiento_inventario", "dosis", "alerta", "usuario"], "ER 2 · Inventario por lote y alertas")
er("er_auditoria", ["usuario", "auditoria", "auditoria_detalle", "mensaje_bot", "bot_clave", "intercambio", "importacion", "importacion_registro", "dosis", "medicamento"], "ER 3 · Usuarios, bot, auditoría e intercambio de datos")

# ---------------------------------------------------------------- Arquitectura general
render("arquitectura", f'''
rankdir=LR; compound=true; label=<<b>Arquitectura del sistema Moncopulli</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fillcolor="{CREMA}", color="{GRIS}"];
subgraph cluster_u {{ label="Personas"; style="rounded,dashed"; color="{GRIS}";
  adm [label="Administrador\\n(oficina)", shape=box, fillcolor="{VERDE_CL}", color="{VERDE}"];
  ope [label="Operario\\n(terreno / bodega)", fillcolor="{VERDE_CL}", color="{VERDE}"];
  aud [label="Auditor\\n(revisión SAG)", fillcolor="{VERDE_CL}", color="{VERDE}"]; }}
subgraph cluster_c {{ label="Canales de uso"; style="rounded"; color="{AZUL}"; fontcolor="{AZUL}";
  panel [label="Panel web\\nReact + Vite\\n(Cloudflare Workers)", fillcolor="{AZUL_CL}", color="{AZUL}"];
  app [label="App móvil Android\\nKotlin + Compose\\n(funciona sin señal)", fillcolor="{AZUL_CL}", color="{AZUL}"];
  bot [label="Bot de Telegram\\n@moncopulli_registro_bot\\n(Cloudflare Worker)", fillcolor="{AZUL_CL}", color="{AZUL}"]; }}
subgraph cluster_s {{ label="Supabase (nube)"; style="rounded"; color="{VERDE}"; fontcolor="{VERDE}";
  auth [label="Supabase Auth\\n(inicio de sesión)", fillcolor="white", color="{VERDE}"];
  fn [label="Funciones seguras fn_*\\n(revisan rol, validan,\\nescriben y auditan)", fillcolor="{VERDE_CL}", color="{VERDE}"];
  db [label="PostgreSQL 17\\n18 tablas · RLS\\ntriggers de stock", shape=cylinder, fillcolor="{VERDE_CL}", color="{VERDE}"];
  edge_fn [label="Edge Function\\ncrear-usuario", fillcolor="white", color="{VERDE}"];
  cron [label="pg_cron\\nalertas cada hora\\nlimpieza de mensajes", fillcolor="white", color="{VERDE}"]; }}
subgraph cluster_g {{ label="GitHub"; style="rounded"; color="{NAR}"; fontcolor="{NAR}";
  ci [label="CI en cada push\\npruebas · lint · build\\nnpm audit · Gitleaks", fillcolor="{NAR_CL}", color="{NAR}"];
  resp [label="Respaldo diario 04:00\\nrestauración de prueba\\nhuella de auditoría · cifrado", fillcolor="{NAR_CL}", color="{NAR}"]; }}
gem [label="Google Gemini\\n(opcional: interpreta texto)", fillcolor="white", style="rounded,dashed"];
adm -> panel; aud -> panel; ope -> app; ope -> bot; ope -> panel [style=dashed];
panel -> auth; app -> auth;
panel -> fn [label="RPC"]; app -> fn [label="RPC fn_app_*"]; bot -> fn [label="fn_bot_*"];
panel -> edge_fn [label="alta de usuarios"]; edge_fn -> fn;
fn -> db; cron -> db; bot -> gem [style=dashed];
resp -> db [label="dump", style=dashed]; ci -> panel [style=dashed, label="valida"]; ci -> bot [style=dashed];
''')

# ---------------------------------------------------------------- Patrón de escritura segura
render("escritura_segura", f'''
rankdir=TB; label=<<b>Cómo se guarda un dato (igual para panel, app y bot)</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fillcolor="{CREMA}", color="{GRIS}", width=3.2];
a [label="1. El usuario toca «Guardar»\\n(panel, app móvil o bot)", fillcolor="{AZUL_CL}", color="{AZUL}"];
b [label="2. La pantalla revisa el formulario\\n(campos vacíos, RUT, DIIO, cantidades)"];
c [label="3. Se llama a una función de la base\\ncon la sesión del usuario (token)"];
d [label="¿Rol con permiso\\ny cuenta activa?", shape=diamond, fillcolor="{NAR_CL}", color="{NAR}", width=2.4];
e [label="¿Datos válidos?\\n(stock, fechas, estados)", shape=diamond, fillcolor="{NAR_CL}", color="{NAR}", width=2.4];
f [label="4. Escribe el registro y el movimiento\\nde stock en UNA transacción", fillcolor="{VERDE_CL}", color="{VERDE}"];
g [label="5. Guarda la auditoría: quién, qué,\\ncuándo, desde dónde, valor antes/después", fillcolor="{VERDE_CL}", color="{VERDE}"];
h [label="6. Recalcula alertas y responde\\n«Guardado» con el resultado", fillcolor="{VERDE_CL}", color="{VERDE}"];
x [label="Rechazo «No tienes permiso»\\n(error 42501) — no se guarda nada", fillcolor="{ROJO_CL}", color="{ROJO}"];
y [label="Mensaje claro al usuario\\n(ej. «El lote tiene solo 100 ml»)\\n— no se guarda nada", fillcolor="{ROJO_CL}", color="{ROJO}"];
a -> b -> c -> d; d -> e [label="sí"]; d -> x [label="no"]; e -> f [label="sí"]; e -> y [label="no"]; f -> g -> h;
''')

# ---------------------------------------------------------------- Estados de una dosis
render("estados_dosis", f'''
rankdir=LR; label=<<b>Ciclo de vida de una dosis</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fontsize=11];
ini [shape=circle, label="", width=0.25, style=filled, fillcolor="{GRIS}"];
P [label="PROGRAMADA", fillcolor="{AZUL_CL}", color="{AZUL}"];
A [label="APLICADA\\n• descuenta lote (FEFO)\\n• calcula resguardo de leche\\n• origen WEBAPP / TELEGRAM / APPMOVIL", fillcolor="{VERDE_CL}", color="{VERDE}"];
O [label="OMITIDA\\n(motivo obligatorio)", fillcolor="{NAR_CL}", color="{NAR}"];
N [label="ANULADA\\n(solo ADMIN, con motivo;\\nel stock vuelve al lote)", fillcolor="{ROJO_CL}", color="{ROJO}"];
ini -> P [label="crear tratamiento"]; ini -> A [label="registro en terreno"];
P -> A [label="aplicar"]; P -> O [label="omitir"]; P -> N [label="anular tratamiento"]; A -> N [label="anular tratamiento\\n(REVERSA_DOSIS)"];
P -> P [label="pasa la fecha →\\nalerta DOSIS_ATRASADA", fontcolor="{ROJO}"];
''')

# ---------------------------------------------------------------- Secuencia offline de la app
render("app_offline", f'''
rankdir=TB; label=<<b>App móvil: registrar sin señal y enviar al volver</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fillcolor="{CREMA}", color="{GRIS}", width=3.4];
a [label="Operario aplica una dosis en el potrero", fillcolor="{AZUL_CL}", color="{AZUL}"];
b [label="¿Hay señal?", shape=diamond, fillcolor="{NAR_CL}", color="{NAR}", width=2];
c [label="Se envía al tiro a fn_app_aplicar_dosis\\nrespuesta: lote usado y resguardo", fillcolor="{VERDE_CL}", color="{VERDE}"];
d [label="Se guarda en la cola del teléfono (Room)\\ncon la HORA REAL de aplicación\\nchip: «1 por enviar»"];
e [label="Vuelve la señal (aunque la app esté cerrada)\\nWorkManager envía la cola\\nreintentos 30 s, 60 s, 120 s…"];
f [label="¿El servidor acepta?", shape=diamond, fillcolor="{NAR_CL}", color="{NAR}", width=2];
g [label="«Enviado» — se registra una sola vez\\n(el identificador único evita duplicados)", fillcolor="{VERDE_CL}", color="{VERDE}"];
h [label="«Rechazado» con motivo en Actividad\\n(ej. sin stock o ya aplicada por otro)\\nDescartar o volver a enviar", fillcolor="{ROJO_CL}", color="{ROJO}"];
a -> b; b -> c [label="sí"]; b -> d [label="no"]; d -> e -> f; f -> g [label="sí"]; f -> h [label="no"];
''')

# ---------------------------------------------------------------- Casos de uso por rol
render("casos_uso", f'''
rankdir=LR; label=<<b>Qué puede hacer cada rol</b>>; labelloc=t; fontsize=16; nodesep=0.18;
node [shape=ellipse, style=filled, fillcolor="{VERDE_CL}", color="{VERDE}", fontsize=10];
ADM [shape=box, style="rounded,filled", fillcolor="{VERDE}", fontcolor="white", label="ADMIN"];
OPE [shape=box, style="rounded,filled", fillcolor="{AZUL}", fontcolor="white", label="OPERARIO"];
AUD [shape=box, style="rounded,filled", fillcolor="{NAR}", fontcolor="white", label="AUDITOR"];
SIS [shape=box, style="rounded,filled", fillcolor="{GRIS}", fontcolor="white", label="SISTEMA\\n(pg_cron)"];
u1 [label="Iniciar sesión"]; u2 [label="Registrar animales\\ny propietarios"]; u3 [label="Entradas y ajustes\\nde stock"];
u4 [label="Crear tratamiento\\ny aplicar/omitir dosis"]; u5 [label="Registrar en terreno\\n(app / Telegram)"]; u6 [label="Ver y resolver alertas"];
u7 [label="Medicamentos y\\nproveedores"]; u8 [label="Crear usuarios,\\ncambiar rol"]; u9 [label="Anular tratamiento"]; u10 [label="Importar datos (JSON)"];
u11 [label="Consultar auditoría"]; u12 [label="Exportar CSV/JSON\\ncon SHA-256"]; u13 [label="Recalcular alertas\\ncada hora"];
OPE -> {{u1 u2 u3 u4 u5 u6}}; ADM -> {{u1 u2 u3 u4 u5 u6 u7 u8 u9 u10 u11 u12}}; AUD -> {{u1 u11 u12}}; SIS -> u13;
edge [arrowhead=none];
''')

# ---------------------------------------------------------------- CI / despliegue / respaldo
render("ci_respaldo", f'''
rankdir=LR; label=<<b>Entorno de trabajo: del código a producción y respaldo</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fillcolor="{CREMA}", color="{GRIS}"];
dev [label="Integrante\\n(rama + commit)", fillcolor="{AZUL_CL}", color="{AZUL}"];
pr [label="Pull request\\nrevisión del equipo"]; ci [label="GitHub Actions CI\\nbot 34 pruebas · panel 35\\nESLint · build\\nnpm audit · Gitleaks\\n(+ Android: lint y JUnit)", fillcolor="{NAR_CL}", color="{NAR}"];
main [label="main"]; mig [label="supabase db push\\n--dry-run → push\\n+ pruebas SQL (ROLLBACK)", fillcolor="{VERDE_CL}", color="{VERDE}"];
dep [label="wrangler deploy\\npanel y bot"]; apk [label="APK release firmado\\n(R8) → teléfono por USB"];
prod [label="Producción\\nSupabase + Cloudflare", shape=cylinder, fillcolor="{VERDE_CL}", color="{VERDE}"];
resp [label="Respaldo diario 04:00\\n1 dump  2 restaurar en contenedor\\n3 comparar filas  4 huella auditoría\\n5 cifrar con age (30 días)", fillcolor="{NAR_CL}", color="{NAR}"];
dev -> pr -> ci -> main; main -> mig -> prod; main -> dep -> prod; main -> apk; prod -> resp [dir=back, style=dashed];
''')

# ---------------------------------------------------------------- Niveles de prueba
render("niveles_prueba", f'''
rankdir=TB; label=<<b>Plan de pruebas por niveles</b>>; labelloc=t; fontsize=16; nodesep=0.2;
node [shape=box, style="rounded,filled", width=7, fontsize=11];
n6 [label="Aceptación y uso: persona sin experiencia aplica una dosis (40 s) · entrevistas con operarios (pendiente)", fillcolor="{ROJO_CL}", color="{ROJO}"];
n5 [label="Seguridad: OWASP ZAP · token falso · RLS con rol anónimo · jadx sobre el APK · Gitleaks · npm audit", fillcolor="{NAR_CL}", color="{NAR}"];
n4 [label="Carga y estrés: k6 con 50, 100, 200 y 400 usuarios · 20 registros sin señal · Monkey 5000 toques", fillcolor="{NAR_CL}", color="{NAR}"];
n3 [label="Sistema (extremo a extremo): Playwright 12 + 14 casos panel · 39 casos app móvil en teléfono real · bot real", fillcolor="{AZUL_CL}", color="{AZUL}"];
n2 [label="Integración con la base: 10 archivos SQL con ROLLBACK simulando cada rol (stock, auditoría, bot, app)", fillcolor="{VERDE_CL}", color="{VERDE}"];
n1 [label="Unitarias: bot 34 · panel 35 · app 14+ (JUnit) · lint y tipos", fillcolor="{VERDE_CL}", color="{VERDE}"];
n6 -> n5 -> n4 -> n3 -> n2 -> n1 [style=invis];
''')

# ---------------------------------------------------------------- Cadena de frío (propuesta)
render("propuesta_frio", f'''
rankdir=LR; label=<<b>Propuesta fase 2: monitoreo de cadena de frío (2–8 °C)</b>>; labelloc=t; fontsize=16;
node [shape=box, style="rounded,filled", fillcolor="{CREMA}", color="{GRIS}"];
s [label="Sensor en refrigerador\\nde vacunas (ESP32)", fillcolor="{AZUL_CL}", color="{AZUL}"];
t [label="Tabla lectura_sensor\\n(Supabase)", shape=cylinder, fillcolor="{VERDE_CL}", color="{VERDE}"];
r [label="Supabase Realtime\\n→ panel en vivo"]; a [label="Alerta TEMPERATURA_FUERA\\n(fn_generar_alertas)", fillcolor="{ROJO_CL}", color="{ROJO}"];
s -> t [label="cada 1 min"]; t -> r; t -> a [label="fuera de rango\\no sin señal 60 s"];
''')
print("listo", sorted(p.name for p in OUT.glob("*.png")))

# ---------------------------------------------------------------- Herramientas por capa (stack actual)
def capa(nombre, color, items):
    filas = "".join(f'<td bgcolor="white" border="1" cellpadding="6"><font point-size="10">{i}</font></td>' for i in items)
    return (f'<tr><td bgcolor="{color}" width="150" cellpadding="8"><font color="white"><b>{nombre}</b></font></td>{filas}'
            + "".join('<td bgcolor="white" border="0"></td>' for _ in range(6 - len(items))) + '</tr>')

capas = [
    ("Personas y canales", AZUL, ["Panel web<br/>React 18 + Vite", "App Android<br/>Kotlin + Compose", "Bot Telegram<br/>Worker TypeScript", "Navegador<br/>Chrome / Edge"]),
    ("Publicación", NAR, ["Cloudflare Workers<br/>panel y bot", "Durable Object<br/>sin duplicados", "APK release<br/>firmado + R8", "Emulador oficial<br/>Android 15"]),
    ("Datos y reglas", VERDE, ["PostgreSQL 17<br/>Supabase", "RLS + funciones<br/>SECURITY DEFINER", "Supabase Auth", "pg_cron", "Edge Function<br/>crear-usuario"]),
    ("Calidad y seguridad", ROJO, ["GitHub Actions CI", "Vitest · node:test<br/>JUnit · Robolectric", "Playwright · k6", "OWASP ZAP · jadx", "Gitleaks · npm audit", "Android Lint<br/>ESLint"]),
    ("Equipo y documentos", GRIS, ["GitHub + PR", "Trello Kanban", "draw.io · Graphviz", "Word / PDF", "Asistentes IA<br/>(apoyo revisado)"]),
]
tabla_html = "".join(capa(*c) for c in capas)
render("stack_capas", f'''
label=<<b>Herramientas en uso, por capa (noviembre 2026)</b>>; labelloc=t; fontsize=16;
t [shape=plain, label=<<table border="0" cellspacing="6" cellpadding="0">{tabla_html}</table>>];
''')

# ---------------------------------------------------------------- Evolución de herramientas (antes -> ahora)
pares = [
    ("Prototipo HTML estático", "Panel React + Vite", "sin sesión ni datos reales"),
    ("Cloudflare Pages", "Cloudflare Workers (assets)", "un solo tipo de despliegue con el bot"),
    ("JMeter desde un PC", "k6 en GitHub Actions", "p95 variaba 118–6 709 ms por la red local"),
    ("Imagen de restauración en ECR", "Imagen en Docker Hub", "límite de descargas de ECR en el CI"),
    ("Cloudflare R2 (planificado)", "Artefacto cifrado con age en GitHub", "sin costo ni credenciales extra"),
    ("Vistas v_* de consulta", "Consultas directas con RLS", "las vistas saltaban el RLS (0013)"),
    ("Bot de texto libre", "Bot con botones + texto opcional", "operarios con guantes y poca señal"),
    ("Firebase (prototipo IoT)", "Supabase como único backend", "datos relacionales y reglas en el motor"),
    ("Flutter / iOS (evaluado)", "Android nativo (Kotlin)", "sin Mac; app ya probada en teléfono"),
    ("Prueba Room en teléfono", "Room con Robolectric en la JVM", "corre en CI sin dispositivo"),
    ("Android Studio para ver la app", "Script de emulador en 1 clic", "el equipo usa iPhone y Windows"),
    ("Diagramas ER a mano", "ER generados del Supabase real", "siempre iguales a producción"),
]
cuerpo = ['rankdir=LR; label=<<b>Evolución de herramientas: qué dejamos y por qué</b>>; labelloc=t; fontsize=16; nodesep=0.12; ranksep=0.5;',
          f'node [shape=box, style="rounded,filled", fontsize=10, width=2.9];']
for i, (a, b, r) in enumerate(pares):
    cuerpo.append(f'a{i} [label="{a}", fillcolor="#eeeeea", color="{GRIS}", fontcolor="{GRIS}"];')
    cuerpo.append(f'b{i} [label="{b}", fillcolor="{VERDE_CL}", color="{VERDE}"];')
    cuerpo.append(f'a{i} -> b{i} [label="{r}", fontsize=9, color="{VERDE}"];')
render("evolucion_herramientas", "\n".join(cuerpo))
print("extra ok")
