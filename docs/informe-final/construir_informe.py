# Construye el Informe Final (Evaluación 3) en .docx
import pathlib
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

S = pathlib.Path(__file__).resolve().parent  # carpeta de trabajo: ajustar D e I si se mueve
D = S / "diag/png"; I = S / "img"
OUT = S / "informe/Informe_Final_Moncopulli_Ev3.docx"

VERDE = RGBColor(0x2f, 0x6b, 0x3a); GRIS = RGBColor(0x5b, 0x61, 0x57)
doc = Document()
for s in doc.sections:
    s.top_margin = s.bottom_margin = Cm(2.5); s.left_margin = s.right_margin = Cm(2.5)

st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(11)
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
st.paragraph_format.space_after = Pt(6); st.paragraph_format.line_spacing = 1.15
for n, size in [("Heading 1", 16), ("Heading 2", 13), ("Heading 3", 11.5)]:
    h = doc.styles[n]; h.font.name = "Calibri"; h.font.size = Pt(size); h.font.bold = True
    h.font.color.rgb = VERDE; h.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    h.paragraph_format.space_before = Pt(14 if n == "Heading 1" else 10); h.paragraph_format.space_after = Pt(6)
    h.paragraph_format.keep_with_next = True

FIG = [0]; TAB = [0]


def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear"); sh.set(qn("w:color"), "auto"); sh.set(qn("w:fill"), color); tcPr.append(sh)


def field(par, instr):
    r = par.add_run(); b = OxmlElement("w:fldChar"); b.set(qn("w:fldCharType"), "begin"); r._r.append(b)
    r = par.add_run(); t = OxmlElement("w:instrText"); t.set(qn("xml:space"), "preserve"); t.text = instr; r._r.append(t)
    r = par.add_run(); s = OxmlElement("w:fldChar"); s.set(qn("w:fldCharType"), "separate"); r._r.append(s)
    par.add_run("Actualizar campo (clic derecho → Actualizar campos)" if "TOC" in instr else "1")
    r = par.add_run(); e = OxmlElement("w:fldChar"); e.set(qn("w:fldCharType"), "end"); r._r.append(e)


def H(t, n=1): doc.add_heading(t, n)


def P(t, bold_prefix=None, italic=False, align=None, size=None):
    p = doc.add_paragraph()
    if bold_prefix:
        p.add_run(bold_prefix).bold = True
    r = p.add_run(t); r.italic = italic
    if size: r.font.size = Pt(size)
    if align: p.alignment = align
    return p


def B(items, style="List Bullet"):
    for it in items:
        p = doc.add_paragraph(style=style)
        if isinstance(it, tuple):
            p.add_run(it[0]).bold = True; p.add_run(it[1])
        else:
            p.add_run(it)


def T(headers, rows, widths=None, titulo=None, font=9.5):
    if titulo:
        TAB[0] += 1
        c = doc.add_paragraph(); r = c.add_run(f"Tabla {TAB[0]}. {titulo}"); r.bold = True; r.font.size = Pt(9.5); r.font.color.rgb = GRIS
        c.paragraph_format.keep_with_next = True; c.paragraph_format.space_after = Pt(2)
    t = doc.add_table(rows=1, cols=len(headers)); t.style = "Table Grid"; t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]; cell.text = ""; run = cell.paragraphs[0].add_run(h); run.bold = True
        run.font.size = Pt(font); run.font.color.rgb = RGBColor(255, 255, 255); shade(cell, "2F6B3A")
    trPr = t.rows[0]._tr.get_or_add_trPr(); th = OxmlElement("w:tblHeader"); th.set(qn("w:val"), "true"); trPr.append(th)
    for k, row in enumerate(rows):
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ""; par = cells[i].paragraphs[0]; par.paragraph_format.space_after = Pt(0)
            txt = str(v)
            if txt.startswith("**"):
                rr = par.add_run(txt.strip("*")); rr.bold = True
            else:
                rr = par.add_run(txt)
            rr.font.size = Pt(font)
            if k % 2 == 1: shade(cells[i], "F1F5EF")
    widths = widths or [16 / len(headers)] * len(headers)
    t.autofit = False
    tblW = t._tbl.tblPr.find(qn("w:tblW"))
    if tblW is None:
        tblW = OxmlElement("w:tblW"); t._tbl.tblPr.append(tblW)
    tblW.set(qn("w:w"), str(int(sum(widths) * 567))); tblW.set(qn("w:type"), "dxa")
    for i, w in enumerate(widths):
        t.columns[i].width = Cm(w)
        for row in t.rows: row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


def F(path, caption, width=16):
    FIG[0] += 1
    p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Cm(width))
    c = doc.add_paragraph(); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = c.add_run(f"Figura {FIG[0]}. {caption}"); r.italic = True; r.font.size = Pt(9.5); r.font.color.rgb = GRIS


def CAJA(titulo, texto, color="E6F0E3"):
    t = doc.add_table(rows=1, cols=1); t.style = "Table Grid"; c = t.rows[0].cells[0]; shade(c, color)
    c.text = ""; p = c.paragraphs[0]; r = p.add_run(titulo + " "); r.bold = True; r.font.color.rgb = VERDE
    p.add_run(texto); doc.add_paragraph().paragraph_format.space_after = Pt(2)


def salto(): doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


# ===================================================================== PORTADA
for _ in range(3): doc.add_paragraph()
P("INACAP · Analista Programador", align=WD_ALIGN_PARAGRAPH.CENTER, size=12)
P("Proyecto Integrado — Evaluación 3, Unidad 3 (Sumativa)", align=WD_ALIGN_PARAGRAPH.CENTER, size=12)
doc.add_paragraph()
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Informe Final"); r.bold = True; r.font.size = Pt(30); r.font.color.rgb = VERDE
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Sistema de registro y control de tratamientos veterinarios,\ninventario de medicamentos y trazabilidad"); r.font.size = Pt(15)
p = doc.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run("Agrícola Moncopulli S.A. — Puyehue, Región de Los Lagos"); r.font.size = Pt(12); r.italic = True
for _ in range(4): doc.add_paragraph()
T(["Dato", "Detalle"], [
    ["Integrantes", "Catalina Pérez · Liliana Bravo · Andy Timbles · Cristóbal Jara"],
    ["Carrera", "Analista Programador"],
    ["Asignatura", "Proyecto Integrado"],
    ["Profesor", "Javier Elgueta"],
    ["Fecha de entrega", "18 de noviembre de 2026"],
    ["Versión", "3.0 — Informe final (reemplaza al informe de avance del 26 de octubre)"],
    ["Repositorio", "github.com/catitaconflow/moncopullis"],
], widths=[4, 12])
salto()

# ===================================================================== ÍNDICE
H("Índice", 1)
field(doc.add_paragraph(), 'TOC \\o "1-2" \\h \\z \\u')
P("Nota: al abrir el documento en Word, haga clic derecho sobre el índice y elija «Actualizar campos» para ver los números de página.", italic=True, size=9)
salto()

# ===================================================================== RESUMEN EJECUTIVO
H("Resumen ejecutivo", 1)
P("Agrícola Moncopulli es una lechería que hasta ahora anotaba en cuadernos, planillas y mensajes los tratamientos que se dan a los animales y los medicamentos que entran y salen de bodega. Eso provoca tres problemas: el stock no cuadra, se pierden datos y cuesta responder cuando el SAG pide saber qué se le aplicó a un animal, con qué lote y hasta cuándo no se puede vender su leche.")
P("Construimos un sistema con una sola base de datos y tres formas de usarla, según dónde esté la persona:")
B([("Panel web ", "para la oficina: administrar medicamentos, animales, tratamientos, usuarios, alertas, exportar e importar datos y revisar la auditoría."),
   ("App móvil Android ", "para el operario en el potrero: aplicar dosis, registrar tratamientos e inventario, incluso sin señal; lo guardado se envía solo al volver la conexión."),
   ("Bot de Telegram ", "como vía rápida: registrar una dosis o consultar stock tocando botones.")])
P("Todas las reglas importantes (quién puede hacer qué, que el stock nunca quede negativo, que nada se borre sin rastro) las aplica la base de datos, no la pantalla. Por eso da lo mismo por dónde entre el dato: siempre queda auditado con quién, cuándo y desde dónde.")
T(["Indicador", "Resultado"], [
    ["Pruebas automáticas re-ejecutadas el 18-11-2026", "Bot 34/34 · Panel 35/35 · ESLint sin errores · build correcto · npm audit 0 vulnerabilidades"],
    ["Pruebas de base de datos", "10 archivos SQL (cada uno en transacción con ROLLBACK); todos pasan"],
    ["Pruebas de interfaz del panel (Playwright)", "12/12 de consulta + 14/14 de registro"],
    ["Pruebas de la app móvil en teléfono real", "37 de 39 casos ejecutados; 36 pasan (97,3 %); 0 defectos graves"],
    ["Carga y estrés", "50 usuarios: p95 entre 27 y 34 ms · hasta 400 usuarios sin fallas"],
    ["Base de datos en producción (verificado en vivo)", "18 tablas, 30 relaciones, 60 índices, RLS en las 18 tablas, 34 funciones seguras, 2 tareas programadas"],
    ["Respaldo", "Diario, con restauración de prueba, verificación de auditoría y cifrado"],
], widths=[6.5, 9.5], titulo="Estado del sistema a la fecha de entrega")

H("Cómo leer este informe frente a la rúbrica", 2)
P("Para facilitar la revisión, cada criterio de la rúbrica apunta a la sección donde está la evidencia.")
T(["Criterio de la rúbrica", "Pts", "Dónde está la evidencia"], [
    ["3.1.1.1 Coherencia interfaz – necesidades del negocio", "5", "Sección 4.1 a 4.3 (matriz proceso → pantalla)"],
    ["3.1.1.2 Lineamientos estéticos y funcionales", "5", "Sección 4.4 y 4.5"],
    ["3.1.x.3 Estructura de la base de datos", "5", "Sección 5.1 a 5.4 (diagramas ER del Supabase real)"],
    ["3.1.x.4 Optimización y normalización", "5", "Sección 5.5 y 5.6"],
    ["3.1.3.5 Patrones de seguridad", "5", "Sección 6"],
    ["3.1.3.6 Colaboración en equipo", "5", "Sección 2.3 a 2.5"],
    ["3.1.4.7 Configuración del entorno", "10", "Sección 7 (paso a paso)"],
    ["3.1.4.8 Documentación de la implementación", "5", "Sección 8 y anexos"],
    ["3.1.5.9 Cobertura del plan de pruebas", "10", "Sección 9"],
    ["3.1.5.10 Ejecución del protocolo de pruebas", "10", "Sección 10"],
    ["3.1.5.11 Validación de resultados", "10", "Sección 11"],
    ["3.1.6.12 Comparación esperado vs. obtenido", "10", "Sección 12"],
    ["3.1.6.13 Recomendaciones", "5", "Sección 13"],
    ["3.1.6.14 Respuesta a preguntas", "5", "Sección 14 (preguntas probables con respuesta)"],
    ["3.1.6.15 Informe final", "5", "Este documento: formato, índice, figuras y tablas numeradas, bibliografía APA"],
], widths=[7.5, 1.2, 7.3], titulo="Mapa de la rúbrica")
salto()

# ===================================================================== 1 INTRODUCCIÓN
H("1. Introducción", 1)
H("1.1 El problema", 2)
P("En el predio trabajan administración, bodega y operarios de terreno. Cada uno anota a su manera: el veterinario deja una indicación, el operario aplica y lo anota en un cuaderno o lo avisa por WhatsApp, y la bodega descuenta (o no) el frasco. Cuando el SAG o un comprador de leche pregunta por un animal, hay que reconstruir la historia a mano. Además, una vaca tratada con antibiótico no puede entregar leche durante un número de días (resguardo); si nadie lo calcula bien, se arriesga leche con residuos.")
H("1.2 Objetivo general", 2)
P("Implementar un sistema de registro y control que mantenga la trazabilidad de los tratamientos veterinarios, el inventario de medicamentos por lote y la actividad de los usuarios, con auditoría de cada acción y que funcione tanto en la oficina como en terreno.")
H("1.3 Objetivos específicos", 2)
B(["Centralizar animales, propietarios, proveedores, medicamentos, lotes y usuarios en una base de datos relacional.",
   "Registrar tratamientos y dosis con responsable, fecha, medicamento, lote usado y fin del resguardo de leche.",
   "Llevar el inventario por lote, de forma que cada entrada, salida o ajuste cambie el stock en el mismo momento y no pueda quedar negativo.",
   "Dejar auditoría que no se pueda modificar, indicando el origen (panel, Telegram, app móvil o sistema).",
   "Permitir el registro en terreno con o sin señal (app móvil) y por mensajería (bot).",
   "Exportar e importar los datos (CSV y JSON) con validación y registro de cada intercambio.",
   "Controlar el acceso por rol, validado en el servidor."])
H("1.4 Alcance", 2)
T(["Dentro del alcance (entregado)", "Fuera del alcance / fase 2"], [
    ["Modelo de datos, autenticación y roles", "Dashboard gerencial con indicadores históricos"],
    ["Animales, propietarios, proveedores, usuarios", "Exportación a PDF"],
    ["Tratamientos, dosis y resguardo de leche", "Versión iOS de la app (ver sección 13)"],
    ["Inventario por lote con alertas de stock, vencimiento y dosis atrasadas", "Monitoreo de temperatura de refrigeradores (propuesta en 13.3)"],
    ["Panel web, bot de Telegram y app Android con modo sin conexión", "Comercialización, finanzas, trazabilidad de carne, EID"],
    ["Exportación, importación, auditoría, respaldo diario y pruebas", ""],
], widths=[8, 8], titulo="Alcance del proyecto")
salto()

# ===================================================================== 2 METODOLOGÍA Y EQUIPO
H("2. Metodología y trabajo en equipo", 1)
H("2.1 Metodología: Scrumban", 2)
P("Trabajamos con Scrumban: sprints de una semana con planificación al inicio y revisión al final, y un tablero Kanban (Pendiente, En desarrollo, En pruebas, Terminado) con límite de 3 tareas en desarrollo y 2 en pruebas. Lo elegimos porque el equipo estudia y trabaja: los sprints dan fechas fijas de revisión y el límite de tareas evita dejar muchas cosas a medias.")
H("2.2 Roles y responsabilidades", 2)
T(["Integrante", "Rol", "Responsabilidad principal"], [
    ["Andy Timbles", "Scrum Master · desarrollo", "Base de datos en Supabase, panel web, bot de Telegram, CI, respaldo y despliegue"],
    ["Liliana Bravo", "Desarrollo · pruebas", "App móvil Android (Kotlin), migraciones 0014–0015, plan y ejecución de pruebas de la app"],
    ["Catalina Pérez", "Desarrollo · datos", "Modelo de datos, diagramas, autenticación, amenazas de seguridad, repositorio"],
    ["Cristóbal Jara", "Calidad", "Pruebas de caja blanca y caja negra, prueba en emulador Android y de red (HTTP Toolkit), revisión de la app"],
    ["Encargado del predio", "Product Owner (cliente)", "Prioriza requisitos y valida cada sprint"],
], widths=[3.5, 4, 8.5], titulo="Roles del equipo")
H("2.3 Cronograma ejecutado", 2)
T(["Sprint", "Fechas", "Entregado"], [
    ["1. Diseño y base de datos", "21 al 27 oct", "Modelo v2, 14 tablas, RLS, triggers de stock, pruebas SQL básicas"],
    ["2. Seguridad, trazabilidad y panel", "28 oct al 3 nov", "Funciones de escritura con rol y auditoría, panel de consulta y registro, alertas cada hora, huella de auditoría"],
    ["3. Telegram, importación y usuarios", "4 al 10 nov", "Bot con botones y confirmación, importación con vista previa, alta de usuarios con clave temporal"],
    ["4. App móvil y pruebas", "11 al 17 nov", "App Android con modo sin conexión, 3 ciclos de pruebas, pruebas de caja blanca/negra"],
    ["Evaluación", "18 nov", "Informe final y defensa"],
], widths=[4.5, 3, 8.5], titulo="Cronograma real")
H("2.4 Cómo colaboramos (evidencia en el repositorio)", 2)
B([("Un solo repositorio ", "en GitHub con una carpeta por componente (supabase/, panel/, bot/, movil/, pruebas/, docs/)."),
   ("Ramas y pull requests: ", "la app móvil se desarrolló en la rama feature/app-movil y se integra por el pull request #1, con tres revisores asignados, descripción de qué incluye, cómo se probó y qué queda pendiente."),
   ("Commits con formato tipo: descripción ", "(feat, fix, test, docs, ci, chore), para que el historial cuente qué cambió y por qué. La rama principal tiene 46 commits y la rama de la app 52."),
   ("Integración continua: ", "cada push ejecuta las pruebas del bot y del panel, revisa el código, compila, revisa dependencias vulnerables y busca secretos filtrados. En la rama de la app también compila Android y corre sus pruebas JUnit."),
   ("Documentación compartida ", "en docs/ (manual técnico, manual de usuario, modelo de datos, guía de entrevista, preguntas de defensa) y movil/README.md."),
   ("Diagramas reproducibles: ", "se generan con scripts (docs/diagramas/generar.py), así cualquier integrante puede corregirlos.")])
H("2.5 Flujo de trabajo del equipo", 2)
F(D / "ci_respaldo.png", "Del código a producción: rama, revisión, CI, despliegue, APK y respaldo diario.", 16.5)
salto()

# ===================================================================== 3 ARQUITECTURA
H("3. Arquitectura de la solución", 1)
P("La idea central es simple: una sola base de datos que guarda y protege todo, y varias «puertas» de entrada según dónde esté el usuario. Ninguna puerta escribe directo en las tablas: todas llaman a funciones de la base que revisan el permiso, validan y dejan la auditoría.")
F(D / "arquitectura.png", "Arquitectura general: personas, canales de uso, Supabase y GitHub.", 16.5)
F(D / "casos_uso.png", "Casos de uso por rol.", 9)
H("3.1 Tecnologías y por qué las elegimos", 2)
T(["Tecnología", "Para qué", "Por qué", "Alternativa descartada"], [
    ["PostgreSQL 17 en Supabase", "Base de datos", "Reglas en el motor (CHECK, triggers, índices parciales), RLS por rol, respaldos administrados", "Firebase/MongoDB: no garantiza relaciones ni transacciones entre tablas"],
    ["Supabase Auth", "Cuentas y sesiones", "Contraseñas con hash y sesiones manejadas por un proveedor", "Hash y JWT propios: más riesgo de error"],
    ["React + Vite + TypeScript", "Panel web", "Formularios con datos en vivo; el tipado detecta errores antes de publicar", "HTML estático sin sesión"],
    ["Cloudflare Workers", "Panel y bot publicados", "Sin servidores que mantener, HTTPS incluido, plan gratuito suficiente", "Servidor propio (parches, SO)"],
    ["Kotlin + Jetpack Compose", "App Android", "Nativa, rápida, base local (Room) y envío en segundo plano (WorkManager)", "Web en el navegador: sin modo sin conexión real"],
    ["Telegram Bot API", "Registro rápido", "Gratis y conocida por el personal", "WhatsApp Business: cobra por conversación"],
    ["GitHub Actions", "CI y respaldo", "Pruebas en cada cambio y respaldo automático diario", "Respaldo manual"],
], widths=[3.3, 2.7, 5.5, 4.5], titulo="Tecnologías elegidas", font=9)
CAJA("¿Por qué Supabase y no Firebase?", "Un integrante exploró Firebase para un monitor de temperatura. Decidimos mantener un solo backend en Supabase porque nuestros datos son muy relacionados (animal → tratamiento → dosis → lote → movimiento) y las reglas críticas (stock no negativo, una sola salida por dosis, auditoría que no se borra) las garantiza PostgreSQL. El trabajo sin señal en terreno lo resuelve la app móvil con su cola local, que era la principal ventaja de Firebase. El monitor de temperatura se propone migrarlo a Supabase en la fase 2 (sección 13.3).")
salto()

# ===================================================================== 4 INTERFACES
H("4. Interfaces y necesidades del negocio", 1)
H("4.1 Necesidades del negocio y cómo se cubren", 2)
P("Partimos de lo que el predio necesita hacer cada día y verificamos que cada proceso tenga al menos una pantalla que lo resuelva.")
T(["Proceso del negocio", "Quién", "Panel web", "App móvil", "Bot"], [
    ["Recibir medicamentos (entrada a bodega por lote)", "Bodega", "✔ Inventario → Registrar entrada", "—", "—"],
    ["Corregir stock (conteo, rotura, vencido)", "Bodega / operario", "✔ Ajuste", "✔ Registrar salida", "—"],
    ["Ver stock bajo y lotes por vencer", "Todos", "✔ Resumen y Alertas", "✔ Filtro «Bajo mínimo»", "✔ Stock bajo"],
    ["Registrar y dar de baja animales", "Administración", "✔ Animales", "—", "—"],
    ["Indicar un tratamiento con varias dosis", "Administración", "✔ Tratamientos", "—", "—"],
    ["Aplicar la dosis programada", "Operario", "✔", "✔ Inicio → Aplicar (sin señal también)", "✔ Registrar dosis"],
    ["Registrar un tratamiento hecho en terreno", "Operario", "✔", "✔ Registrar", "✔"],
    ["Saber hasta cuándo no entregar leche", "Operario / lechería", "✔ Aviso al aplicar", "✔ Filtro «En resguardo»", "✔ En la confirmación"],
    ["Omitir una dosis con motivo", "Operario", "✔", "✔ (con señal)", "—"],
    ["Anular un tratamiento mal ingresado", "Administración", "✔ (solo ADMIN)", "—", "—"],
    ["Crear cuentas y asignar rol", "Administración", "✔ Maestros → Usuarios", "—", "—"],
    ["Responder al SAG / auditoría", "Auditor", "✔ Auditoría y Exportar con SHA-256", "—", "—"],
    ["Migrar o respaldar datos", "Administración", "✔ Importar / Exportar", "—", "—"],
], widths=[5, 2.6, 3.4, 3.2, 1.8], titulo="Matriz proceso del negocio → interfaz", font=8.5)
P("Resultado: los 13 procesos definidos tienen al menos una interfaz que los resuelve; los que ocurren en terreno tienen además una vía móvil.")
H("4.2 Panel web", 2)
F(I / "02_resumen_escritorio.png", "Resumen del panel: indicadores con color (rojo requiere atención, verde en orden) que llevan al detalle.", 14)
F(I / "07_inventario_movimientos.png", "Detalle de un medicamento: lotes, botones de entrada y ajuste e historial de movimientos.", 14)
F(I / "08_tratamiento_aplicado.png", "Tratamiento con dosis aplicada y aviso de resguardo de leche.", 14)
F(I / "panel_movil.png", "El mismo panel en un celular de 360 px: barra inferior y tablas convertidas en tarjetas.", 13)
H("4.3 App móvil Android", 2)
P("La app tiene cinco pestañas pensadas para el trabajo en terreno: Inicio (dosis de hoy y atrasadas), Animales (con filtro de resguardo), Registrar, Inventario y Actividad (lo enviado, pendiente y rechazado). Arriba siempre se ve si hay conexión o cuántos registros esperan envío.")
F(I / "app_login_aplicar.png", "App móvil: mismo mensaje ante contraseña o correo incorrecto (no revela qué correos existen) y aviso tras aplicar una dosis con lote y fecha de resguardo.", 15)
F(D / "app_offline.png", "Cómo la app registra sin señal y envía al volver la conexión.", 12)
H("4.4 Lineamientos estéticos y funcionales", 2)
T(["Lineamiento", "Cómo se cumple", "Evidencia"], [
    ["Identidad visual común", "Paleta verde del predio en panel y app; logo de Moncopulli en login, ícono y pestaña Animales; fuente Nunito en la app", "Figuras 4 a 8"],
    ["Contraste legible (WCAG 2.2 AA)", "Texto oscuro sobre fondo crema; modo oscuro automático en el panel", "panel/src/index.css"],
    ["Botones grandes para usar con guantes", "Área táctil mínima de 44 px en panel; botones de ancho completo en la app; menú de botones en el bot", "Figuras 7 y 8"],
    ["Retroalimentación en cada acción", "Estados de carga, vacío, error y éxito; botones deshabilitados mientras se guarda; mensajes en lenguaje simple", "Casos E5, E8, W1, MOV-11"],
    ["Responsive", "Panel de 360 px a escritorio; app adaptada a fuente grande", "P20, P25, MOV-37"],
    ["Prevención de errores", "Confirmación antes de guardar en el bot; fechas futuras bloqueadas; DIIO de 9 dígitos validado", "MOV-10, MOV-13"],
    ["Accesibilidad", "Animaciones se apagan si el sistema lo pide; textos largos con «…» en vez de cortarse", "Animaciones.tsx, DEF-01"],
], widths=[3.8, 8, 4.2], titulo="Lineamientos y cumplimiento", font=9)
H("4.5 Mejora de la interfaz móvil (en curso)", 2)
P("En las pruebas, el equipo y la persona de prueba de uso consideraron que la interfaz de la app se ve funcional pero anticuada, y la prueba de accesibilidad con fuente al máximo dejó un defecto visual abierto (DEF-02). Por eso la siguiente iteración es un rediseño completo de la interfaz móvil, manteniendo intacta la lógica probada (cola sin conexión, funciones del servidor). Los objetivos del rediseño son: tarjetas con jerarquía clara (hora arriba, DIIO y medicamento a todo el ancho), estados con color e ícono, navegación más limpia y consistencia total con el panel (caso MOV-38).")
salto()

# ===================================================================== 5 BASE DE DATOS
H("5. Base de datos", 1)
P("Los diagramas de esta sección se generaron leyendo directamente la base de datos de producción en Supabase el 18 de noviembre de 2026, por lo que muestran exactamente lo que está funcionando y no un diseño teórico.")
H("5.1 Cómo leer los diagramas", 2)
P("Cada caja es una tabla. 🔑 marca la clave primaria (el identificador único de cada fila), ↗ marca una clave foránea (un dato que apunta a otra tabla) y UK indica que el valor no se puede repetir. En cada línea, el número junto a una tabla dice cuántas filas de esa tabla se relacionan con una de la otra. Ejemplo: entre propietario y animal aparece 0..1 junto a propietario (un animal tiene uno o ningún propietario) y 0..* junto a animal (un propietario puede tener muchos animales). Los colores agrupan las áreas: verde sanitario, azul inventario, naranja usuarios/bot/auditoría y gris intercambio de datos.")
F(D / "er_general.png", "Vista general del modelo: 18 tablas y 30 relaciones (solo columnas clave).", 16.5)
F(D / "er_sanitario.png", "ER 1: animales, tratamientos, dosis y documentos veterinarios.", 15)
F(D / "er_inventario.png", "ER 2: inventario por lote, movimientos y alertas.", 15)
F(D / "er_auditoria.png", "ER 3: usuarios, bot, auditoría e intercambio de datos.", 12)
H("5.2 Tablas y su función", 2)
T(["Tabla", "Qué guarda", "Reglas principales"], [
    ["usuario", "Personas con acceso y su rol", "Ligada a la cuenta de Supabase Auth; RUT con dígito verificador; rol ADMIN, OPERARIO o AUDITOR"],
    ["propietario", "Dueños de animales arrendados", "RUT único"],
    ["animal", "Bovinos del predio", "DIIO único de 9 dígitos; madre (linaje); baja con fecha y motivo"],
    ["proveedor", "Proveedores de medicamentos", "Se desactiva, no se borra"],
    ["medicamento", "Catálogo y stock total", "Nombre único; stock total = suma de lotes (lo mantiene un trigger)"],
    ["lote", "Lote con vencimiento y su stock", "Único por medicamento y número; stock nunca negativo"],
    ["tratamiento", "Indicación para un animal", "Se anula con motivo, nunca se borra"],
    ["dosis", "Cada aplicación", "Estados PROGRAMADA, APLICADA, OMITIDA, ANULADA; si está aplicada exige lote, fecha, responsable y origen"],
    ["movimiento_inventario", "Historial (kárdex) por lote", "Solo inserción; máximo una salida y una reversa por dosis"],
    ["alerta", "Stock bajo, vencimiento, dosis atrasada", "Una sola alerta abierta por tipo y objeto"],
    ["auditoria / auditoria_detalle", "Quién hizo qué, cuándo y desde dónde; valor anterior y nuevo", "Solo inserción; huella encadenada SHA-256"],
    ["mensaje_bot / bot_clave", "Mensajes del bot y clave del bot", "No se procesa dos veces el mismo mensaje; la clave se guarda solo como hash"],
    ["intercambio / importacion / importacion_registro", "Exportaciones e importaciones", "Huella SHA-256; un archivo no se importa dos veces"],
    ["documento_veterinario", "Recetas y certificados", "Asociado a animal o tratamiento; no se modifica"],
], widths=[4, 4.5, 7.5], titulo="Las 18 tablas", font=9)
H("5.3 Relaciones clave para la trazabilidad", 2)
P("La pregunta típica del SAG es «¿qué recibió este animal, de qué lote y quién lo aplicó?». El modelo la responde siguiendo las relaciones: animal → tratamiento → dosis → lote → medicamento, y la dosis apunta a quién la aplicó (usuario) y a su movimiento de inventario. A la inversa, desde un lote retirado del mercado se puede saber a qué animales se aplicó.")
F(D / "estados_dosis.png", "Ciclo de vida de una dosis y efecto en el stock.", 16)
H("5.4 Datos estructurados y no estructurados", 2)
P("Casi todo es estructurado (tablas con tipos y reglas). Los datos no estructurados son el texto libre que el operario escribe al bot (se borra solo a los 30 días por la tarea programada moncopulli-retencion-bot), los archivos de recetas guardados en Supabase Storage (la tabla guarda solo su ruta) y los registros importados, que se guardan como JSON en importacion_registro.datos para conservar el original.")
H("5.5 Normalización", 2)
P("El modelo está en tercera forma normal (3FN). En palabras simples: cada dato se guarda en un solo lugar y depende solo de la clave de su tabla.")
T(["Forma normal", "Qué exige", "Cómo se cumple (ejemplo real)"], [
    ["1FN", "Valores atómicos, sin listas en una celda", "Las dosis de un tratamiento son filas en dosis, no una lista dentro de tratamiento"],
    ["2FN", "Nada depende de solo parte de la clave", "Todas las tablas usan una clave simple (id); el lote tiene su propia tabla en vez de repetir vencimiento en cada movimiento"],
    ["3FN", "Nada depende de otro dato que no sea la clave", "El nombre del medicamento vive solo en medicamento; dosis y movimiento guardan solo medicamento_id"],
], widths=[2.3, 5, 8.7], titulo="Normalización aplicada", font=9)
P("Hay dos excepciones decididas a propósito (desnormalización controlada), ambas protegidas:")
B([("stock_actual en medicamento: ", "se podría calcular sumando los lotes, pero se guarda para consultar el stock al instante. Un trigger lo mantiene igual a la suma y otro impide escribirlo a mano."),
   ("fin_resguardo_leche en dosis: ", "es un hecho histórico. Si mañana cambian los días de resguardo de un medicamento, la fecha calculada al aplicar no debe cambiar.")])
H("5.6 Optimización", 2)
T(["Técnica", "Detalle", "Beneficio"], [
    ["60 índices", "En todas las claves foráneas y en búsquedas frecuentes (auditoría por entidad y por usuario y fecha)", "Consultas rápidas aunque crezcan los datos"],
    ["7 índices parciales", "Ej.: una sola alerta ABIERTA por tipo y objeto; una sola SALIDA_DOSIS por dosis", "Reglas de negocio garantizadas por el motor y con índices pequeños"],
    ["Claves foráneas compuestas", "movimiento (dosis_id, medicamento_id) → dosis; (lote_id, medicamento_id) → lote", "Imposible descontar de un lote de otro medicamento"],
    ["Triggers de stock", "El stock del lote y del medicamento cambian en la misma transacción del movimiento", "Nunca hay diferencia entre historial y stock"],
    ["ON DELETE RESTRICT", "En todas las relaciones", "Lo que tiene historial no se borra por accidente"],
    ["Tareas programadas (pg_cron)", "Alertas cada hora; limpieza de texto del bot a los 30 días", "Avisos aunque nadie abra el panel; menos datos personales guardados"],
    ["Carga diferida en el panel", "Cada pantalla se descarga al abrirla; librerías en archivos aparte", "Entrada de 26 kB; ningún archivo sobre 230 kB"],
    ["Caché local en la app", "Room guarda dosis, animales e inventario", "Lista de 300 animales en 0,50 s"],
], widths=[3.5, 7.5, 5], titulo="Optimización de la base y del acceso a datos", font=9)
salto()

# ===================================================================== 6 SEGURIDAD
H("6. Seguridad", 1)
P("La seguridad no depende de esconder botones. Usamos varias capas, de modo que si una falla la siguiente detiene el problema (defensa en profundidad).")
F(D / "escritura_segura.png", "Patrón de escritura segura: rol, validación, transacción y auditoría.", 11)
H("6.1 Patrones de seguridad implementados", 2)
T(["Patrón", "Cómo se implementa", "Probado en"], [
    ["Autenticación delegada", "Supabase Auth guarda contraseñas con hash; clave temporal de 14 caracteres que se debe cambiar en el primer ingreso", "U1–U9, MOV-05"],
    ["Autorización en el servidor (mínimo privilegio)", "RLS en las 18 tablas solo permite leer; toda escritura pasa por funciones que revisan rol y cuenta activa", "P13, P14, P23, P26, O1–O21"],
    ["Validación en dos capas", "El formulario avisa; la función de la base vuelve a validar (el formulario se puede saltar)", "MOV-10 a MOV-16"],
    ["Consultas parametrizadas", "Nunca se arma SQL con texto del usuario; funciones con argumentos tipados", "Revisión de código, ZAP"],
    ["Registro inmutable y huella encadenada", "Auditoría de solo inserción + huella SHA-256 recalculada en cada respaldo", "P9, P21, P28"],
    ["Idempotencia", "Cada registro tiene uuid; reintentos no duplican (app, bot, importación)", "MOV-27, MOV-31, I8"],
    ["Secretos fuera del código", "Clave anon pública en clientes; service_role solo en la Edge Function; Gitleaks en cada push", "MOV-34, MOV-35"],
    ["Verificación del webhook", "Telegram envía un secreto; sin él responde 403; mensajes repetidos se descartan", "B2, B8, A.4"],
    ["Cabeceras HTTP de seguridad", "CSP, X-Frame-Options, nosniff, CORP en el Worker", "P16, P17 (ZAP)"],
    ["Mensajes que no filtran información", "Mismo mensaje para correo inexistente y contraseña errónea; mismo mensaje para cualquier fallo de vinculación", "MOV-02, B3–B5"],
    ["Ofuscación del APK", "R8 reduce y ofusca: 263 de 270 clases sin nombre legible", "MOV-34"],
    ["Dependencias revisadas", "npm audit en cada push; React Router actualizado a 7.18.4", "P18; re-ejecución 18-11: 0 vulnerabilidades"],
    ["Respaldo cifrado", "Copia diaria cifrada con age; la clave privada no está en GitHub", "P27"],
], widths=[4, 8, 4], titulo="Patrones de seguridad", font=9)
H("6.2 Cobertura frente a OWASP Top 10 (2021)", 2)
T(["Riesgo OWASP", "Medida"], [
    ["A01 Control de acceso roto", "RLS + funciones con revisión de rol; probado llamando funciones de ADMIN con OPERARIO y AUDITOR (42501)"],
    ["A02 Fallas criptográficas", "HTTPS en todo; SHA-256 para códigos, clave del bot y huellas; respaldo cifrado"],
    ["A03 Inyección", "Consultas parametrizadas; ESLint prohíbe eval, innerHTML y HTML sin escapar; CSV protegido contra fórmulas"],
    ["A04 Diseño inseguro", "Revisión de seguridad del bot corrigió 3 hallazgos medios antes del piloto"],
    ["A05 Configuración insegura", "Cabeceras de seguridad; ZAP baseline sin alertas medias o altas"],
    ["A06 Componentes vulnerables", "npm audit y Gitleaks en CI"],
    ["A07 Fallas de autenticación", "Supabase Auth, bloqueo de intentos, código de vinculación de 6 dígitos, 10 minutos y 3 intentos"],
    ["A08 Integridad de datos", "Auditoría inmutable, huella encadenada, SHA-256 en exportaciones"],
    ["A09 Registro y monitoreo", "Auditoría con origen; respaldo que falla si la auditoría fue alterada"],
    ["A10 SSRF", "El Worker no descarga URLs indicadas por el usuario"],
], widths=[4.5, 11.5], titulo="OWASP Top 10", font=9)
H("6.3 Riesgos residuales (lo que no está resuelto)", 2)
B(["La sesión y las bases locales de la app no están cifradas en el teléfono (recomendación R-06).",
   "Las reglas de extracción de datos de Android siguen siendo la plantilla; hay que excluir caché y cola (R-05).",
   "Quien tenga la contraseña de administración de la base podría desactivar triggers; la huella no lo impide, pero lo detecta al día siguiente."])
salto()

# ===================================================================== 7 ENTORNO
H("7. Configuración del entorno de trabajo (paso a paso)", 1)
P("Esta sección permite que cualquier persona del equipo, o un tercero, deje funcionando el sistema completo desde cero. Las claves nunca van en el código ni en este informe.")
H("7.1 Requisitos", 2)
T(["Herramienta", "Versión", "Para qué"], [
    ["Git", "2.x", "Clonar el repositorio"],
    ["Node.js", "20 o superior (CI usa 24)", "Panel, bot y CLI de Supabase/Wrangler con npx"],
    ["Cuenta Supabase", "Proyecto «Moncopulli» (us-west-2)", "Base de datos, Auth y Edge Functions"],
    ["Cuenta Cloudflare", "Plan gratuito", "Publicar panel y bot"],
    ["Android Studio + JDK 25", "Android SDK Platform 37 y Build-Tools 37.0.0", "Compilar la app móvil"],
    ["Teléfono Android", "8.0 o superior, con depuración USB", "Instalar el APK por cable"],
], widths=[4, 5.5, 6.5], titulo="Requisitos del entorno", font=9)
H("7.2 Paso 1 — Obtener el código", 2)
P("git clone https://github.com/catitaconflow/moncopullis.git  y luego  cd moncopullis", size=10)
H("7.3 Paso 2 — Base de datos", 2)
B(["npx supabase login  (inicia sesión con la cuenta del proyecto)",
   "npx supabase link --project-ref <referencia>  (pide la contraseña de la base)",
   "npx supabase migration list  (compara lo local con lo aplicado)",
   "npx supabase db push --dry-run  (muestra qué se aplicaría, sin cambiar nada)",
   "npx supabase db push  (aplica las migraciones pendientes, 0001 a 0015)",
   "npx supabase db query --linked -f supabase/tests/<archivo>.sql  (ejecuta cada prueba; terminan en ROLLBACK y no dejan datos)"], style="List Number")
CAJA("Importante:", "al 18-11-2026 la base de producción tiene aplicadas las migraciones 0001 a 0013. Las 0014 y 0015 (funciones de la app móvil) están en el pull request #1 y se aplicaron solo en el proyecto de pruebas. Deben aplicarse en producción al aprobar el pull request; sin ellas la app inicia sesión y lista datos, pero no puede aplicar ni registrar.", "FBEEDD")
H("7.4 Paso 3 — Panel web", 2)
B(["cd panel  y  npm ci  (instala las dependencias exactas)",
   "Copiar .env.example a .env.local y completar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (solo la clave anon)",
   "npm run dev  → abre http://localhost:5173",
   "npm test, npm run lint y npm run build  (deben terminar sin errores)",
   "npx wrangler deploy  (publica en Cloudflare)"], style="List Number")
P("Si falta .env.local el panel muestra «Configuración incompleta» indicando qué variables faltan, en vez de fallar (comprobado en la prueba BB-01 en emulador Android).")
H("7.5 Paso 4 — Bot de Telegram", 2)
B(["cd bot  y  npm test",
   "Cargar secretos: npx wrangler secret put TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_ANON_KEY, BOT_CLAVE_DB (y GEMINI_API_KEY opcional)",
   "npx wrangler deploy",
   "Registrar el webhook en Telegram con setWebhook indicando la URL del Worker y el secret_token"], style="List Number")
H("7.6 Paso 5 — Alta de usuarios", 2)
P("npx supabase functions deploy crear-usuario. Supabase inyecta sus propias claves; no hay que cargar secretos. Solo acepta llamadas desde el panel publicado y desde localhost:5173.")
H("7.7 Paso 6 — App móvil y APK por cable", 2)
B(["Abrir la carpeta movil/ en Android Studio",
   "Copiar local.properties.example a local.properties y completar supabase.url y supabase.anonKey",
   "Instalar SDK Platform 37 y Build-Tools 37.0.0 desde SDK Manager",
   "Compilar la versión de prueba: ./gradlew assembleDebug  (o assembleRelease con la firma del equipo)",
   "En el teléfono: Ajustes → Acerca del teléfono → tocar 7 veces «Número de compilación» → Opciones de desarrollador → activar «Depuración por USB»",
   "Conectar el teléfono por cable y ejecutar: adb install -r app/build/outputs/apk/debug/app-debug.apk",
   "Alternativa sin adb: copiar el .apk al teléfono por cable (modo transferencia de archivos), abrirlo y permitir «instalar apps desconocidas»"], style="List Number")
H("7.8 Paso 7 — Verificación después de instalar", 2)
T(["Comprobación", "Resultado esperado"], [
    ["Abrir /inventario del panel sin sesión", "Redirige a /login"],
    ["POST /telegram/webhook sin secreto", "403"],
    ["POST /importar sin token", "401"],
    ["Login en la app con cuenta AUDITOR", "«Tu rol no tiene acceso a la app móvil.»"],
    ["select jobname from cron.job", "moncopulli-alertas y moncopulli-retencion-bot"],
], widths=[8, 8], titulo="Verificación del entorno", font=9)
H("7.9 Variables y secretos", 2)
T(["Nombre", "Dónde se guarda", "Uso"], [
    ["VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY", "panel/.env.local (no se sube)", "Conexión pública del panel"],
    ["supabase.url / supabase.anonKey", "movil/local.properties (no se sube)", "Conexión pública de la app"],
    ["TELEGRAM_* , BOT_CLAVE_DB, GEMINI_API_KEY", "wrangler secret", "Bot"],
    ["SUPABASE_DB_URL, AGE_PUBLIC_KEY", "Secretos de GitHub Actions", "Respaldo diario"],
    ["service_role", "Solo dentro de la Edge Function", "Crear cuentas; nunca en clientes"],
], widths=[5.5, 5, 5.5], titulo="Variables y secretos", font=9)
salto()

# ===================================================================== 8 DOCUMENTACIÓN
H("8. Documentación de la implementación", 1)
T(["Documento", "Ubicación", "Contenido"], [
    ["README del repositorio", "README.md", "Estructura, requisitos, comandos de base de datos y bot, secretos"],
    ["Manual técnico", "docs/manual-tecnico.md (anexo B del informe de avance)", "Componentes, instalación, reglas del motor, funciones, pruebas, despliegue, respaldo, bot, usuarios, problemas frecuentes"],
    ["Manual de usuario", "docs/manual-usuario.md", "Qué puede hacer cada rol y cada pantalla, mensajes comunes, uso del bot"],
    ["README de la app móvil", "movil/README.md", "Funciones, sin conexión, arquitectura MVVM, versiones, compilar, instalar, pruebas, licencias"],
    ["Modelo de datos", "docs/modelo-datos-v2.md y sección 5", "Tablas, relaciones, cardinalidades, decisiones"],
    ["Migraciones comentadas", "supabase/migrations/0001–0015", "Cada cambio de esquema explicado en el propio archivo"],
    ["Diagramas editables", "docs/diagramas/*.drawio y generador", "ER, componentes, despliegue, casos de uso, flujo del bot"],
    ["Planillas de pruebas", "pruebas/panel/resultados_e2e.md, movil/pruebas/resultados_movil.md", "Casos, esperado, obtenido y evidencia"],
    ["Preguntas de defensa", "docs/preguntas-defensa.md y sección 14", "Respuestas verificables"],
], widths=[3.8, 5.2, 7], titulo="Documentación disponible", font=9)
H("8.1 Cómo se mantiene el sistema", 2)
B(["Cambiar el esquema: crear una migración nueva (nunca editar una aplicada) con su prueba SQL, revisar con --dry-run y aplicar.",
   "Agregar una pantalla: usar los componentes compartidos (Tabla, Filtros, Diálogo) y llamar a una función fn_* existente o nueva.",
   "Rotar una clave: generar con openssl rand -hex 32, guardar con wrangler secret put y actualizar el hash en la base.",
   "Si el respaldo falla en la huella: la auditoría cambió; comparar con el respaldo anterior y revisar quién tiene la contraseña de la base."])
salto()

# ===================================================================== 9 PLAN DE PRUEBAS
H("9. Plan de pruebas", 1)
H("9.1 Objetivo y criterio", 2)
P("Verificar que cada proceso del negocio funciona por cada canal, que las reglas de stock, permisos y auditoría se cumplen aunque alguien intente saltarse la pantalla, y que el sistema aguanta carga, uso sin señal y entradas incorrectas. Un caso pasa solo si el resultado coincide en todos sus puntos con lo esperado y queda evidencia. Los criterios se fijaron antes de ejecutar.")
F(D / "niveles_prueba.png", "Niveles del plan de pruebas.", 15)
H("9.2 Técnicas utilizadas", 2)
T(["Técnica", "Qué significa", "Dónde la usamos"], [
    ["Caja blanca", "Se prueba conociendo el código: cada regla interna y sus ramas", "Pruebas unitarias del bot, panel y app; pruebas SQL de cada función"],
    ["Caja negra", "Se prueba solo con entrada y salida visible, sin mirar el código", "Casos E2E del panel, 39 casos de la app, emulador Android, HTTP Toolkit"],
    ["Valores límite", "Probar justo en el borde de lo permitido", "Cantidad 0, −1, «abc», 1,234; DIIO de 8 dígitos; salida de 101 con stock 100"],
    ["Partición de equivalencia", "Un caso representativo por grupo de entradas", "Rol ADMIN / OPERARIO / AUDITOR / desactivado / con clave temporal"],
    ["Estrés", "Llevar al sistema más allá del uso normal", "k6 hasta 400 usuarios; 20 registros sin señal; Monkey 5000 toques al azar"],
    ["Seguridad", "Intentar romper permisos y buscar secretos", "ZAP, token falso, RLS anónimo, jadx sobre el APK, Gitleaks"],
    ["Regresión", "Repetir casos tras corregir", "Ciclo 2 de la app; re-ejecución del 18-11"],
    ["Usabilidad", "Una persona real sin experiencia", "MOV-39 (40,37 s)"],
], widths=[3.2, 5.5, 7.3], titulo="Técnicas de prueba", font=9)
H("9.3 Cobertura de casos de uso", 2)
T(["Caso de uso", "Panel", "App móvil", "Bot", "Base de datos"], [
    ["Iniciar sesión y roles", "E1–E3, P26", "MOV-01 a 06", "B3–B5", "U1–U9"],
    ["Registrar entrada y ajuste de stock", "W2–W4", "MOV-15 a 17", "—", "O2–O7, P1–P8"],
    ["Animales", "W5", "MOV-18, 32", "C1", "O8–O10"],
    ["Crear tratamiento y aplicar dosis", "W6–W8", "MOV-07 a 14, 21–31", "P29, B6–B13", "O11–O15, 0014, 0015"],
    ["Omitir / anular", "W10", "MOV-09", "—", "O16–O18"],
    ["Alertas", "W9", "—", "Stock bajo", "O4, O7, O14"],
    ["Auditoría", "W11–W12", "MOV-27 (origen APPMOVIL)", "B12", "P9, H1–H5"],
    ["Exportar / importar", "W13, P32", "—", "—", "I1–I8"],
    ["Crear usuarios", "U (panel)", "—", "—", "U1–U9"],
    ["Uso sin conexión", "—", "MOV-19 a 24, 31", "—", "—"],
    ["Carga, estrés, seguridad", "P12, P31, ZAP", "MOV-34 a 36, AUT-04", "A.4, A.6", "P13, P14"],
], widths=[4.5, 2.5, 3.5, 2.5, 3], titulo="Matriz de cobertura (caso de uso × canal)", font=8.5)
P("Cada caso de uso tiene al menos tres pruebas, y los procesos críticos (aplicar dosis y stock) se prueban en los cuatro niveles: pantalla, función de la base, carga y seguridad.")
H("9.4 Criterios de aceptación", 2)
T(["ID", "Criterio", "Meta"], [
    ["CA-01", "Acceso, procesos y sin conexión de la app", "100 %"],
    ["CA-02", "Total de casos manuales de la app", "≥ 95 %"],
    ["CA-03", "Pruebas automáticas (bot, panel, JUnit, Room)", "100 %"],
    ["CA-04", "Análisis estático (ESLint, Android Lint)", "0 errores; advertencias con decisión"],
    ["CA-05", "Robustez Monkey", "0 cierres y 0 congelamientos"],
    ["CA-06", "Cola sin conexión", "20 enviados, 0 duplicados"],
    ["CA-07", "Rendimiento", "Lista de 300 animales < 2 s; p95 web < 500 ms"],
    ["CA-08", "Usabilidad", "Aplicar una dosis sin ayuda < 60 s"],
    ["CA-09", "Defectos abiertos", "0 de severidad Alta"],
], widths=[1.8, 9, 5.2], titulo="Criterios de aceptación", font=9)
salto()

# ===================================================================== 10 EJECUCIÓN
H("10. Ejecución del protocolo de pruebas", 1)
H("10.1 Protocolo seguido", 2)
B(["Preparar un entorno de pruebas separado de producción (Supabase de pruebas con datos marcados [FALSO]; 300 animales).",
   "Anotar la versión probada (commit) antes de cada ciclo.",
   "Ejecutar primero las pruebas automáticas y guardar sus reportes.",
   "Ejecutar los casos manuales en orden, verificando cada resultado en el panel (stock, tratamiento y auditoría).",
   "Anotar el resultado en el momento con textos y números exactos; guardar captura o registro.",
   "Ejecutar las pruebas al azar (Monkey) al final, para que no alteren los datos de los casos manuales.",
   "Registrar cada diferencia como defecto (DEF) u observación (OBS); corregir y repetir en un ciclo de regresión."], style="List Number")
H("10.2 Bitácora de ejecución", 2)
T(["Fecha", "Qué se ejecutó", "Versión", "Responsable", "Resultado"], [
    ["21–28 oct", "Pruebas SQL 0001–0012, pentest manual, ZAP, carga y estrés en GitHub Actions, respaldo", "main", "Andy Timbles", "Todas pasan tras correcciones (P10, P11, P17, P18)"],
    ["26–27 oct", "Playwright panel: 12 consulta + 14 registro + roles", "main", "Andy Timbles", "26/26 y roles OK"],
    ["28 oct", "Bot de punta a punta con datos ficticios", "main", "Andy Timbles", "Registro con origen TELEGRAM"],
    ["12–15 nov", "App ciclo 0: 14 casos durante el desarrollo", "f8dec89 a 4cbf7cf", "Liliana Bravo", "14/14"],
    ["16 nov", "App ciclo 1: 23 casos, JUnit, Lint, Monkey", "eb28540", "Liliana Bravo", "22/23; DEF-01 y 4 OBS"],
    ["16 nov", "App ciclo 2: corrección y regresión", "6d25a75", "Liliana Bravo", "OBS corregidas; DEF-02 abierto"],
    ["17 nov", "Caja blanca y caja negra; emulador Pixel 8; HTTP Toolkit", "ZIP del repositorio", "Cristóbal Jara", "69 pruebas OK; NET-03 inconcluso"],
    ["18 nov", "Re-ejecución de regresión antes de entregar", "main 8e18e13", "Equipo", "Bot 34/34, panel 35/35, lint, build, audit 0"],
], widths=[2, 5.5, 2.6, 2.6, 3.3], titulo="Bitácora de ejecución", font=8.5)
H("10.3 Resultados por componente", 2)
T(["Componente", "Casos", "Pasan", "Evidencia"], [
    ["Base de datos (SQL con ROLLBACK)", "0001: 9 · 0002: 5 · 0003: 8 · 0005: 21 · 0007: 5 · 0008: 13 · 0010: 4 · 0012: 9 · 0014 · 0015", "Todas", "supabase/tests/; anexo A del avance"],
    ["Bot (node:test)", "34", "34", "Re-ejecutado el 18-11"],
    ["Panel unitarias (Vitest)", "35", "35", "Re-ejecutado el 18-11"],
    ["Panel E2E (Playwright)", "26 + roles", "26 + roles", "pruebas/panel/"],
    ["App móvil manual (teléfono real)", "39 planificados / 37 ejecutados", "36", "movil/pruebas/"],
    ["App automáticas", "JUnit 14 · Lint · Monkey s42", "Todas las ejecutadas", "Reportes HTML ciclos 1 y 2"],
    ["Carga k6 (50 usuarios, 3 corridas)", "470 892 solicitudes", "0 fallas; p95 27–34 ms", "resumen-1..3.json"],
    ["Estrés k6 (100/200/400)", "60 050 solicitudes", "0 fallas; p95 ≤ 69 ms", "resumen-estres.json"],
    ["Seguridad", "ZAP, token, RLS, jadx, Gitleaks, audit", "Sin hallazgos medios o altos", "pruebas/seguridad/"],
    ["Caja negra Android (emulador) y red", "BB-01, BB-02, NET-01 a NET-04", "5 de 6 (NET-03 inconcluso)", "Informe de caja blanca/negra"],
], widths=[4.3, 5, 2.7, 4], titulo="Resultados por componente", font=8.5)
H("10.4 Resultados de la app móvil por grupo", 2)
T(["Grupo", "Casos", "Ejecutados", "Pasan", "No pasan", "No ejecutados"], [
    ["A. Acceso y roles", "6", "6", "6", "0", "0"],
    ["B. Procesos", "12", "12", "12", "0", "0"],
    ["C. Sin conexión", "6", "6", "6", "0", "0"],
    ["D. Concurrencia e integridad", "6", "6", "6", "0", "0"],
    ["E. Estrés y rendimiento", "3", "2", "2", "0", "1 (MOV-33)"],
    ["F. Seguridad", "3", "3", "3", "0", "0"],
    ["G. Usabilidad", "3", "2", "1", "1 (MOV-37)", "1 (MOV-38)"],
    ["**Total", "**39", "**37", "**36", "**1", "**2"],
], widths=[5, 1.6, 2, 1.6, 2.4, 3.4], titulo="App móvil: resumen por grupo", font=9)
F(I / "app_rechazo.png", "App: rechazo «ya aplicada por otro usuario» en el ciclo 1 (ofrecía reenviar) y en el ciclo 2 (solo Descartar), y botón «Siguiente» destacado.", 15)
F(I / "MOV-27_c1.png", "Auditoría tras doble toque en Confirmar: una sola fila por acción, origen APPMOVIL.", 11)
F(I / "MOV-34a_c1.png", "Búsqueda de «service_role» en el APK con jadx: 0 resultados.", 10)
salto()

# ===================================================================== 11 VALIDACIÓN
H("11. Validación de resultados", 1)
P("Validar significa comprobar que los resultados son confiables y que el sistema cumple lo que el negocio necesita, no solo que «las pruebas dieron verde».")
H("11.1 Cumplimiento de criterios", 2)
T(["Criterio", "Meta", "Resultado", "¿Cumple?"], [
    ["CA-01", "100 % grupos A, B y C", "24 de 24", "Sí"],
    ["CA-02", "≥ 95 % de 39 casos", "36/39 = 92,3 % (36/37 ejecutados = 97,3 %)", "No (faltan 2 por ejecutar)"],
    ["CA-03", "100 % automáticas", "Bot 34/34, panel 35/35, JUnit 14/14; Room sin ejecutar", "Parcial"],
    ["CA-04", "0 errores de análisis", "ESLint 0; Android Lint 0 errores, 20 advertencias con decisión", "Sí"],
    ["CA-05", "0 cierres en 3 semillas", "0 y 0 en semilla 42 (2 veces); 7 y 123 sin ejecutar", "Parcial"],
    ["CA-06", "20 enviados, 0 duplicados", "20 en 2,3 s; SQL: 20 distintos", "Sí"],
    ["CA-07", "< 2 s y p95 < 500 ms", "0,50 s; p95 27–69 ms", "Sí"],
    ["CA-08", "< 60 s", "40,37 s", "Sí"],
    ["CA-09", "0 defectos Alta", "0 (1 Baja abierto)", "Sí"],
], widths=[2, 4, 7, 3], titulo="Validación frente a criterios de aceptación", font=9)
H("11.2 ¿Son confiables los resultados?", 2)
B([("Repetibilidad: ", "la carga con JMeter desde un computador variaba de 118 a 6 709 ms con la misma carga. Lo repetimos con k6 desde GitHub Actions tres veces y el p95 quedó entre 27 y 34 ms. Concluimos que la variación era de la red del computador, no del sistema."),
   ("Verificación cruzada: ", "cada caso de la app se verificó también en el panel (stock, tratamiento y auditoría) y, cuando importaba, con una consulta SQL (20 registros, 20 distintos)."),
   ("Regresión: ", "el 18-11 repetimos las pruebas automáticas sobre la versión de entrega con los mismos resultados del informe de avance."),
   ("Independencia: ", "las pruebas de caja blanca y caja negra las hizo un integrante distinto del que programó."),
   ("Límites declarados: ", "no damos por hecha ninguna prueba sin evidencia; lo no ejecutado aparece como «No ejecutado».")])
H("11.3 Validación con el negocio", 2)
P("La prueba de uso con una persona sin experiencia mostró que el flujo principal se entiende (40 segundos), pero generó cuatro preguntas que son reglas del negocio y deben validarse con el encargado del predio: si el operario debe poder elegir el lote, si hace falta un aviso de resguardo al momento de la ordeña, si el resguardo depende de la categoría del animal (vaca, ternero, toro) y si el panel debe advertir dosis duplicadas. Las entrevistas con operarios del predio (historia 1) siguen pendientes y son la validación que falta para declarar la aceptación formal.")
salto()

# ===================================================================== 12 ESPERADO VS OBTENIDO
H("12. Comparación de resultados esperados y obtenidos", 1)
P("Esta tabla reúne todas las diferencias encontradas en el proyecto, con su causa y lo que se hizo. Una diferencia no es necesariamente un error del sistema: a veces el error estaba en la prueba o en el entorno, y lo dejamos explícito.")
T(["ID", "Esperado", "Obtenido", "Causa", "Acción / estado"], [
    ["P10", "Migración 0002 aplica", "Falló: campo de 12 caracteres", "Migración aplicada a mano antes de su ajuste", "Migración 0004; desde entonces se compara historial local y remoto"],
    ["P11", "/importar sin token → 401", "404", "Worker publicado era anterior al código", "Redesplegado; responde 401"],
    ["P12", "p95 < 500 ms estable", "118 a 6 709 ms", "Red del computador que generaba carga", "k6 en GitHub Actions: 27–34 ms"],
    ["P17", "ZAP sin alertas", "1 baja + 2 informativas", "Faltaba cabecera CORP", "Agregada en cabeceras.ts"],
    ["P18", "npm audit 0 altas", "2 altas, 2 moderadas", "Versiones sin parche", "supabase-js 2.117.3, React Router 7.18.4 → 0"],
    ["P21", "Borrar auditoría rechazado", "Se borró (en modo réplica)", "PostgreSQL no ejecuta triggers en ese modo", "Huella encadenada lo detecta (P28)"],
    ["P24", "14 formularios abren", "No abrían", "Doble montaje de React en desarrollo cerraba el diálogo", "Corregido en Dialogo.tsx; 14/14"],
    ["P32", "Importación auditada", "No auditaba; uuid mal formado daba error técnico", "El informe describía algo que el código no hacía", "Migración 0011; pruebas I7 e I8"],
    ["MOV-37 c1 (DEF-01)", "Textos legibles con fuente máxima", "Palabras partidas", "Etiquetas sin límite de líneas; columna de hora de ancho fijo", "Parcialmente corregido (6d25a75)"],
    ["MOV-37 c2 (DEF-02)", "DIIO y medicamento legibles", "Terminan en «…»", "«Atrasada» bajo la hora agranda la columna y quita ancho", "Abierto → rediseño de tarjetas (R-01)"],
    ["MOV-11 (OBS-01)", "Botón conserva su texto", "Cambiaba a «Reintentar»", "No distinguía error de validación de error de red", "Corregido y verificado"],
    ["MOV-25 (OBS-02)", "Solo «Descartar»", "Ofrecía «Volver a enviar»", "Todos los rechazos se trataban igual", "Corregido y verificado"],
    ["MOV-30 (OBS-03)", "Formulario se conserva", "Se perdían los campos", "Estado solo en memoria, sin SavedStateHandle", "Corregido: 7 campos se conservan"],
    ["MOV-39 (OBS-04)", "Avanzar en calendario sin dudar", "Tocó el día marcado", "«Siguiente» no se veía como acción principal", "Botón relleno; verificado"],
    ["NET-03", "Tráfico Android visible en HTTP Toolkit", "Error TLS -202", "Proxy manual sin certificado de confianza instalado", "Inconcluso; usar el flujo ADB de HTTP Toolkit"],
    ["BB-01", "Panel funcional en Android", "«Configuración incompleta»", "El ZIP no trae .env.local (correcto: no se suben claves)", "Comportamiento esperado; repetir con Supabase de pruebas"],
    ["npm ci (17-11)", "0 vulnerabilidades", "19 avisos (2 críticos)", "npm ci cuenta también herramientas de desarrollo; el CI audita solo producción", "Re-ejecutado 18-11 --omit=dev: 0; revisar las de desarrollo (R-12)"],
    ["Migraciones", "Producción con 0001–0015", "Producción con 0001–0013", "PR #1 aún no fusionado", "Aplicar 0014–0015 al aprobar el PR (R-13)"],
], widths=[2.2, 3, 3, 4, 3.8], titulo="Discrepancias entre lo esperado y lo obtenido", font=8)
H("12.1 Lectura de las discrepancias", 2)
B(["De 18 diferencias, 12 están corregidas y verificadas, 1 es comportamiento esperado, 2 son pendientes de entorno (NET-03, migraciones) y 3 quedan abiertas con recomendación.",
   "Ninguna diferencia perdió o duplicó datos ni permitió una acción no autorizada.",
   "El patrón más repetido fue «lo desplegado o documentado no coincidía con el código» (P10, P11, P32, migraciones). La medida fue comparar siempre historial local y remoto y re-ejecutar las pruebas antes de cada entrega."])
salto()

# ===================================================================== 13 RECOMENDACIONES
H("13. Recomendaciones y mejora continua", 1)
T(["ID", "Recomendación", "Origen", "Prioridad", "Cómo sabremos que está cerrada"], [
    ["R-13", "Fusionar el PR #1 y aplicar migraciones 0014 y 0015 en producción", "Discrepancia migraciones", "Alta", "migration list muestra 0015 en remoto; pruebas 0014 y 0015 pasan"],
    ["R-03", "Ejecutar AUT-02 (Room), Monkey semillas 7 y 123, MOV-33 (red lenta) y MOV-38", "CA-02, CA-03, CA-05", "Alta", "Los 3 criterios en «Sí»"],
    ["R-04", "Llevar al cliente las 4 preguntas de la prueba de uso y repetir MOV-39 con un operario real", "OBS-04, sección 11.3", "Alta", "Tabla de entrevistas completa"],
    ["R-05", "Excluir caché, cola y sesión de la transferencia entre dispositivos (data_extraction_rules.xml)", "Revisión de código", "Alta", "Prueba de transferencia sin datos de la app"],
    ["R-01", "Rediseñar la interfaz móvil (tarjetas, jerarquía, consistencia con el panel)", "DEF-02, opinión del equipo", "Media", "MOV-37 y MOV-38 pasan"],
    ["R-06", "Cifrar sesión y bases locales (SQLCipher + Android Keystore)", "Revisión de código", "Media", "Inspección del almacenamiento sin datos legibles"],
    ["R-07", "Probar error de red en Registrar, rechazo «pertenece a otro usuario» y corte a mitad de envío", "OBS-01, OBS-02, MOV-28", "Media", "3 casos nuevos pasan"],
    ["R-08", "Que otro integrante repita los grupos A a D sobre el APK final", "Ejecutora = desarrolladora", "Media", "Planilla firmada por otra persona"],
    ["R-14", "Completar NET-03 con el flujo ADB de HTTP Toolkit contra el Supabase de pruebas", "NET-03", "Media", "Captura de solicitudes Android con respuesta"],
    ["R-06b", "Entorno de staging (Supabase + Worker) con E2E en cada PR", "Pruebas en producción con datos ficticios", "Media", "CI despliega a staging"],
    ["R-12", "Revisar los avisos de npm en dependencias de desarrollo", "npm ci 17-11", "Baja", "npm audit sin críticos"],
    ["R-02/R-10", "Terminar DEF-01 en Inventario; limpiar recursos sin uso", "DEF-01, Lint", "Baja", "Lint sin UnusedResources"],
], widths=[1.6, 5.4, 3, 1.6, 4.4], titulo="Recomendaciones priorizadas", font=8.5)
H("13.1 Versión para iPhone", 2)
P("El equipo evaluó ofrecer la app también en iOS. La app actual es nativa de Android (Kotlin). Para no mantener dos aplicaciones distintas, la alternativa recomendada es reescribir la interfaz en Flutter, que genera desde un mismo código el APK de Android y la app de iOS, reutilizando las mismas funciones fn_app_* de Supabase. Hay que considerar que instalar en un iPhone requiere un Mac con Xcode y una cuenta de Apple Developer; un APK solo se instala en Android.")
H("13.2 Mejora continua del proceso", 2)
B(["Mantener la regla «sin evidencia no hay prueba aprobada».",
   "Agregar la app al CI con Lint y JUnit en cada pull request (ya implementado en la rama de la app).",
   "Revisión cruzada: quien programa no es quien firma la prueba de aceptación."])
H("13.3 Propuesta: monitoreo de la cadena de frío", 2)
P("Un integrante desarrolló un prototipo que muestra en vivo la temperatura y humedad de sensores con alerta fuera del rango de 2 a 8 °C, el rango de conservación de vacunas. Se propone integrarlo en la fase 2 sobre Supabase, como un nuevo tipo de alerta, para que una falla del refrigerador no inutilice el stock sin que nadie lo note.")
F(D / "propuesta_frio.png", "Propuesta de integración del monitor de temperatura (fase 2, no implementado).", 14)
salto()

# ===================================================================== 14 PREGUNTAS
H("14. Preparación para la defensa: preguntas probables", 1)
QA = [
    ("¿Qué pasa si un operario intenta hacer algo que no le corresponde, por ejemplo anular un tratamiento?", "La base de datos lo rechaza con error 42501 aunque llame a la función directamente; el panel muestra «No tienes permiso». Ocultar el botón es solo comodidad. Lo probamos con las cuentas OPERARIO y AUDITOR (P26)."),
    ("¿Cómo evitan que el stock quede mal?", "El stock solo cambia insertando un movimiento; un trigger actualiza el lote y el total en la misma transacción, otro impide escribirlo a mano y una restricción impide que un lote quede negativo (P1 a P8)."),
    ("¿Y si se corta la señal en el potrero?", "La app guarda la aplicación en el teléfono con la hora real y la envía sola al volver la red, aun con la app cerrada. Cada registro tiene un identificador único, así que un reintento no duplica (MOV-21 a 31: 20 registros, 0 duplicados)."),
    ("¿Qué pasa si dos personas aplican la misma dosis?", "La primera queda registrada; la segunda recibe «Esta dosis ya fue aplicada por otro usuario» y el stock baja una sola vez (MOV-25)."),
    ("¿Cómo saben si alguien borró la auditoría?", "La auditoría es de solo inserción. Además, cada respaldo diario recalcula una huella SHA-256 encadenada; si una fila cambió o se borró, el respaldo falla (P28)."),
    ("¿Por qué Supabase y no Firebase?", "Datos muy relacionados con reglas que debe garantizar el motor (stock, una salida por dosis, auditoría). PostgreSQL lo hace con restricciones y transacciones; el modo sin conexión lo resuelve la app."),
    ("¿Está normalizada la base?", "Sí, en 3FN. Hay dos excepciones a propósito: stock_actual (protegido por triggers) y fin_resguardo_leche (dato histórico que no debe cambiar)."),
    ("¿Dónde están las claves secretas?", "Nunca en el código. Los clientes usan la clave pública anon; la clave de servicio vive solo en la Edge Function. Gitleaks revisa cada push y jadx confirmó que el APK no la contiene."),
    ("¿Qué no alcanzaron a hacer?", "Las entrevistas con operarios, 5 pruebas de la app de menor prioridad, aplicar 0014–0015 en producción y el rediseño visual de la app. Están en las recomendaciones con su criterio de cierre."),
    ("¿Cómo restauran si se pierde la base?", "Se descarga el respaldo cifrado del día, se abre con la clave privada del equipo y se cargan roles, esquema y datos en ese orden. Se prueba automáticamente cada día en un contenedor limpio (P27)."),
]
for q, a in QA:
    p = doc.add_paragraph(); r = p.add_run("P: " + q); r.bold = True; r.font.color.rgb = VERDE
    doc.add_paragraph("R: " + a)
salto()

# ===================================================================== 15 CONCLUSIÓN
H("15. Conclusión", 1)
P("El sistema resuelve las necesidades diarias del predio: registrar la llegada de medicamentos, controlar el stock por lote, registrar animales y tratamientos, aplicar dosis desde la oficina, el potrero o Telegram, y saber hasta cuándo no entregar la leche de una vaca. Todo queda auditado, se puede exportar para el SAG y se respalda cada día.")
P("Las reglas importantes las aplica la base de datos, no la pantalla, y las probamos con cada rol, con carga, sin señal y buscando fallas de seguridad. Las diferencias encontradas se documentaron con su causa y la mayoría ya está corregida. Lo que falta, principalmente validar con los operarios del predio y completar cinco pruebas de la app, está identificado con su prioridad y su criterio de cierre.")
P("Como aprendizaje del equipo, nos quedamos con la regla de no dar por hecha ninguna prueba sin evidencia: varias veces el código, el despliegue y lo que decía el informe no coincidían, y solo lo detectamos porque volvimos a probar.")

# ===================================================================== BIBLIOGRAFÍA
H("Bibliografía", 1)
for ref in [
    "Android Developers. (s. f.). Guide to app architecture. https://developer.android.com/topic/architecture",
    "Biblioteca del Congreso Nacional de Chile. (2024). Ley 21.719 que regula la protección y el tratamiento de los datos personales. https://www.bcn.cl/leychile",
    "Cloudflare. (s. f.). Cloudflare Workers documentation. https://developers.cloudflare.com/workers/",
    "International Organization for Standardization. (2023). ISO/IEC 25010:2023 Systems and software engineering — Product quality model. ISO.",
    "International Software Testing Qualifications Board. (2024). Certified Tester Foundation Level Syllabus v4.0.1. https://istqb.org",
    "Kruchten, P. (1995). The 4+1 view model of architecture. IEEE Software, 12(6), 42–50.",
    "OWASP Foundation. (2021). OWASP Top 10:2021. https://owasp.org/Top10/",
    "PostgreSQL Global Development Group. (2025). PostgreSQL 17 documentation. https://www.postgresql.org/docs/17/",
    "Servicio Agrícola y Ganadero. (s. f.). Programa Oficial de Trazabilidad Animal. https://www.sag.gob.cl",
    "Supabase. (s. f.). Row Level Security. https://supabase.com/docs/guides/database/postgres/row-level-security",
    "Telegram. (s. f.). Telegram Bot API. https://core.telegram.org/bots/api",
    "W3C. (2023). Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/WCAG22/",
]:
    p = doc.add_paragraph(ref); p.paragraph_format.left_indent = Cm(1); p.paragraph_format.first_line_indent = Cm(-1)

# ===================================================================== ANEXOS
salto()
H("Anexo A. Evidencia de la re-ejecución del 18 de noviembre de 2026", 1)
T(["Comando", "Resultado"], [
    ["cd bot && npm test", "tests 34 · pass 34 · fail 0"],
    ["cd panel && npm test", "Test Files 8 passed · Tests 35 passed"],
    ["npm run lint", "Sin errores"],
    ["npm run build", "Compilación correcta"],
    ["npm audit --omit=dev", "found 0 vulnerabilities"],
    ["Consulta a Supabase producción", "18 tablas con RLS; 30 claves foráneas; 60 índices (7 parciales); 43 funciones, 34 SECURITY DEFINER; tareas cron moncopulli-alertas y moncopulli-retencion-bot; migraciones 0001–0013"],
], widths=[5.5, 10.5], titulo="Re-ejecución antes de la entrega", font=9)
H("Anexo B. Evidencias de accesibilidad de la app", 1)
F(I / "app_accesibilidad.png", "MOV-37 con fuente y pantalla al máximo: ciclo 1 (palabras partidas) y ciclo 2 (texto con «…»).", 10)
H("Anexo C. Pantallas por rol en el panel", 1)
F(I / "11_rol_operario.png", "Menú del rol OPERARIO: sin Auditoría ni Exportar.", 13)
F(I / "11_rol_auditor.png", "Menú del rol AUDITOR: solo consulta, Auditoría y Exportar.", 13)
H("Anexo D. Documentos complementarios", 1)
B(["Informe de avance (Evaluación 2) con manual técnico, manual de usuario, guía de entrevista y esquema simple (anexos B a E).",
   "Informe «Pruebas de la app móvil» (plan, 3 ciclos, defectos y recomendaciones).",
   "Informe «Pruebas de caja blanca y caja negra» (panel, emulador Android y HTTP Toolkit).",
   "Repositorio: código, migraciones, pruebas, reportes y diagramas editables."])

# pie de página con número
for s in doc.sections:
    p = s.footer.paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("Moncopulli · Informe final · página "); r.font.size = Pt(8); r.font.color.rgb = GRIS
    field(p, "PAGE")

doc.save(OUT)
print("ok", OUT, "figuras", FIG[0], "tablas", TAB[0])
