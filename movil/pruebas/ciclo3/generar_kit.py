# Kit para el equipo: planilla del ciclo 3 (app v2 en emulador) y formulario de entrevistas.
import pathlib
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = pathlib.Path(__file__).parent / "Kit_ciclo3_y_entrevistas.docx"
VERDE = RGBColor(0x2f, 0x6b, 0x3a)
doc = Document()
s = doc.sections[0]
s.orientation = WD_ORIENT.LANDSCAPE
s.page_width, s.page_height = s.page_height, s.page_width
for m in ("top_margin", "bottom_margin", "left_margin", "right_margin"):
    setattr(s, m, Cm(1.6))
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10)
for n in ("Heading 1", "Heading 2"):
    doc.styles[n].font.color.rgb = VERDE; doc.styles[n].font.name = "Calibri"


def shade(c, col):
    p = c._tc.get_or_add_tcPr(); e = OxmlElement("w:shd")
    e.set(qn("w:val"), "clear"); e.set(qn("w:fill"), col); p.append(e)


def tabla(enc, filas, anchos, alto_vacio=False):
    t = doc.add_table(rows=1, cols=len(enc)); t.style = "Table Grid"; t.autofit = False
    for i, h in enumerate(enc):
        c = t.rows[0].cells[i]; c.text = ""; r = c.paragraphs[0].add_run(h); r.bold = True
        r.font.color.rgb = RGBColor(255, 255, 255); r.font.size = Pt(9); shade(c, "2F6B3A")
    for f in filas:
        cs = t.add_row().cells
        for i, v in enumerate(f):
            cs[i].text = ""; r = cs[i].paragraphs[0].add_run(v); r.font.size = Pt(9)
        if alto_vacio:
            t.rows[-1].height = Cm(1.4)
    for row in t.rows:
        for i, w in enumerate(anchos): row.cells[i].width = Cm(w)
    doc.add_paragraph()


doc.add_heading("Ciclo 3 de pruebas: app móvil v2 en el emulador", 1)
doc.add_paragraph("Versión probada: APK release de la app v2 (commit 029a5af o posterior). Entorno: emulador Pixel 8, Android 15 "
                  "(INICIAR_EMULADOR.bat) contra el Supabase de producción, usando SOLO registros marcados [FALSO]. "
                  "Ejecutora: ____________________   Fecha: ____/____/2026   Hora inicio: ______")
doc.add_heading("Antes de empezar", 2)
for t in [
    "En el panel web, crear un tratamiento de prueba para un animal [FALSO] con 2 dosis programadas para ahora, usando un medicamento [FALSO] con stock.",
    "Herramientas en la carpeta del emulador: CAPTURA_PANTALLA.bat (guarda una captura con el nombre del caso), FUENTE_MAX.bat / FUENTE_NORMAL.bat (MOV-37), RED_LENTA.bat / RED_NORMAL.bat (MOV-33).",
    "Para cortar Internet: bajar la cortina del emulador y desactivar «Internet» (o modo avión).",
    "Anotar lo obtenido con el texto exacto que muestra la app. Si algo no coincide, marcar «No» y describirlo; no corregir el resultado.",
]:
    doc.add_paragraph(t, style="List Bullet")

casos = [
    ("C3-01 (MOV-01)", "Iniciar sesión con cuenta ADMIN; cerrar la app y volver a abrirla", "Entra a Inicio; al reabrir sigue con la sesión"),
    ("C3-02 (MOV-02)", "Iniciar sesión con contraseña incorrecta", "«Correo o contraseña incorrectos.»"),
    ("C3-03", "Revisar el resumen de Inicio y compararlo con el panel", "Contadores «por aplicar» y «atrasadas» iguales a lo programado"),
    ("C3-04 (MOV-07)", "Aplicar la dosis [FALSO] con la hora actual", "Aviso con lote (el que vence primero) y fecha de resguardo; en el panel, auditoría con origen APPMOVIL"),
    ("C3-05 (MOV-17)", "Inventario → Registrar salida de 1 ml, motivo «Conteo físico»", "«Salida registrada…»; el stock baja 1 en la app y en el panel"),
    ("C3-06 (MOV-21)", "Sin Internet: aplicar la segunda dosis [FALSO]", "Queda guardada; la pastilla superior dice «1 por enviar»"),
    ("C3-07 (MOV-22)", "Volver a activar Internet", "En segundos pasa a «Enviado» en Actividad; en el panel queda con la hora de aplicación, no la del envío"),
    ("C3-08 (MOV-33)", "RED_LENTA.bat y registrar una aplicación en Registrar", "Indicador de carga; la app no se congela; se registra"),
    ("C3-09 (MOV-37)", "FUENTE_MAX.bat y recorrer Inicio, Animales, Inventario y Actividad", "Ninguna palabra partida; DIIO y medicamento legibles; botones apilados"),
    ("C3-10 (MOV-38)", "Comparar la app con el panel (colores, logo, tipografía)", "Mismo verde, mismo logo; estilo consistente"),
    ("C3-11", "Menú de cuenta (avatar) → «Abrir panel web»", "Se abre el navegador en el panel de Moncopulli"),
    ("C3-12 (MOV-06)", "Con un registro pendiente, intentar cerrar sesión", "Pide confirmar y advierte que se perderán los pendientes"),
]
tabla(["ID", "Pasos", "Resultado esperado", "Resultado obtenido (texto exacto)", "¿Pasa?", "Captura"],
      [(a, b, c, "", "", "") for a, b, c in casos], [2.4, 5.2, 5.6, 7.4, 1.4, 2.4], alto_vacio=True)
doc.add_paragraph("Defectos u observaciones encontrados: ______________________________________________________________"
                  "____________________________________________________________________________________________")

doc.add_page_break()
doc.add_heading("Entrevista de validación con operarios (historia 1)", 1)
doc.add_paragraph("Duración 20 a 30 min. Mostrar el panel y la app en el emulador o notebook. Anotar respuestas textuales.  "
                  "Entrevistador: ______________   Fecha: ____/____/2026   Participante (rol): ______________")
secciones = {
    "A. Encargado o administración": [
        "¿Cómo registran hoy un tratamiento: cuaderno, planilla, WhatsApp u otro?",
        "¿Cuántos animales en ordeña tienen y cuántos tratamientos hacen por semana?",
        "¿Qué datos pide el SAG o la planta lechera al revisar un tratamiento?",
        "¿Alguna vez se entregó leche de una vaca en resguardo? ¿Cómo lo detectaron?",
        "¿Cada cuánto cuentan el stock y se les han vencido medicamentos?",
        "Con el panel abierto: ¿qué le falta o le sobra a la pantalla Resumen?",
    ],
    "B. Operario en terreno": [
        "¿Tiene señal en la sala de ordeña y en los potreros?",
        "Pídale que aplique una dosis en la app sin ayuda. Tiempo: ______ s. ¿Dónde dudó?",
        "Pídale que registre una aplicación sin Internet. ¿Entendió el aviso «por enviar»?",
        "¿Qué nombre usa para cada medicamento: comercial, principio activo o apodo?",
        "¿Mide las dosis en ml, en frascos o «a ojo»?",
        "¿Debe poder elegir el lote o basta con el que vence primero? (pregunta de la prueba de uso)",
        "¿Haría falta un aviso de resguardo al momento de la ordeña?",
    ],
    "C. Cierre": ["Del 1 al 5, ¿qué tan fácil le resultó la app? ____   ¿Y el panel? ____", "¿Qué cambiaría primero?"],
}
for tit, preg in secciones.items():
    doc.add_heading(tit, 2)
    tabla(["#", "Pregunta", "Respuesta"], [(str(i + 1), p, "") for i, p in enumerate(preg)], [0.8, 10.5, 13.3], alto_vacio=True)
doc.add_heading("Tabla para el informe (sección 7.4)", 2)
tabla(["Fecha", "Participante (rol)", "Hallazgo", "Cambio en el diseño", "Estado"],
      [("", "Encargado", "", "", ""), ("", "Operario 1", "", "", ""), ("", "Operario 2", "", "", "")],
      [2.5, 3.5, 7.5, 7.5, 3.6], alto_vacio=True)
doc.save(OUT)
print("ok", OUT)
