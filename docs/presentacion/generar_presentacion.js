// Presentación de defensa Moncopulli (Evaluación 3), ordenada según la rúbrica.
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa");
const gi = require("react-icons/gi");
const ASPECT = require("./aspect.json");
const { applyTheme } = require("/root/.claude/skills/synced/7044a103-c0d3-478d-83cd-db5dbb96dae7_67c5f775-4055-4239-bacb-38ec67e7e06a/pptx/scripts/apply_theme.js");

const THEME = {
  name: "Moncopulli",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "17201A", lt1: "FFFFFF", dk2: "1F5C3A", lt2: "EEF4EC",
    accent1: "1F5C3A", accent2: "B5651D", accent3: "2C5D8A", accent4: "A33A2C", accent5: "8FD4A9", accent6: "5E6A60",
    hlink: "2C5D8A", folHlink: "5E6A60",
  },
};
const HEX = { verde: "1F5C3A", verdeOsc: "15432A", tinte: "EEF4EC", gris: "5E6A60", borde: "DCE2D6", ambar: "B5651D", rojo: "A33A2C", azul: "2C5D8A", claro: "8FD4A9" };

async function icono(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.title = "Moncopulli: defensa del proyecto";
  pres.author = "Equipo Moncopulli";
  pres.company = "INACAP";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333, H = 7.5, M = 0.6;

  // ---------------- Layouts
  pres.defineSlideMaster({
    title: "PORTADA", background: { color: HEX.verdeOsc },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 2.2, w: 8.2, h: 1.4, fontSize: 54, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: "bottom", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: M, y: 3.75, w: 8.2, h: 2.2, fontSize: 20, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "SECCION", background: { color: HEX.verde },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 2.4, w: 9, h: 1.3, fontSize: 44, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: "bottom", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "body", type: "body", x: M, y: 3.9, w: 9, h: 1.6, fontSize: 20, color: C.background2, valign: "top", align: "left", margin: 0 }, text: "" } },
    ],
    slideNumber: { x: W - 1.1, y: H - 0.5, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: "right" },
  });
  pres.defineSlideMaster({
    title: "CONTENIDO", background: { color: "FFFFFF" },
    margin: [0.4, M, 0.7, M],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: M, y: 0.35, w: W - 2 * M - 3.9, h: 0.85, fontSize: 30, bold: true, color: C.text2, fontFace: THEME.headFontFace, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { text: { text: "Moncopulli · Proyecto Integrado · Evaluación 3", options: { x: M, y: H - 0.5, w: 6, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
    ],
    slideNumber: { x: W - 1.1, y: H - 0.5, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: "right" },
  });

  const imgFit = (s, file, x, y, maxW, maxH, name, sombra = false) => {
    const a = ASPECT[file]; let w = maxW, h = maxW / a;
    if (h > maxH) { h = maxH; w = maxH * a; }
    const ox = x + (maxW - w) / 2, oy = y + (maxH - h) / 2;
    const opt = { path: "img/" + file, x: ox, y: oy, w, h, objectName: name, altText: name };
    if (sombra) opt.shadow = { type: "outer", color: "000000", opacity: 0.18, blur: 6, offset: 2, angle: 90 };
    s.addImage(opt);
    return { x: ox, y: oy, w, h };
  };
  const tarjeta = (s, x, y, w, h, name, fondo = C.background2) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fondo }, line: { color: fondo }, objectName: name });
  const circulo = async (s, Comp, x, y, d, fondoHex, iconHex, name) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fondoHex === "tinte" ? C.background2 : fondoHex }, line: { type: "none" }, objectName: name + " (círculo)" });
    s.addImage({ data: await icono(Comp, iconHex), x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, objectName: name, altText: name });
  };
  const sub = (s, text, x, y, w, name, color = C.text2, size = 18) =>
    s.addText(text, { x, y, w, h: 0.4, fontSize: size, bold: true, color, margin: 0, isTextBox: true, objectName: name, fontFace: THEME.headFontFace });
  const texto = (s, text, x, y, w, h, name, opts = {}) =>
    s.addText(text, { x, y, w, h, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: name, ...opts });
  const vinetas = (items) => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6 } }));
  const rubrica = (s, txt) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: W - M - 3.6, y: 0.5, w: 3.6, h: 0.5, rectRadius: 0.25, fill: { color: C.background2 }, line: { type: "none" }, objectName: "Criterio de rúbrica (fondo)" });
    s.addText(txt, { x: W - M - 3.6, y: 0.5, w: 3.6, h: 0.5, fontSize: 12, bold: true, color: C.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Criterio de rúbrica" });
  };
  const titulo = (s, t) => s.addText(t, { placeholder: "title" });

  // =============================================== 1 PORTADA
  pres.addSection({ title: "Inicio" });
  let s = pres.addSlide({ masterName: "PORTADA", sectionTitle: "Inicio" });
  s.addText("Moncopulli", { placeholder: "title" });
  s.addText([
    { text: "Trazabilidad de tratamientos veterinarios e inventario de medicamentos", options: { breakLine: true, fontSize: 22 } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Catalina Pérez · Liliana Bravo · Andy Timbles · Cristóbal Jara", options: { breakLine: true, fontSize: 17 } },
    { text: "Proyecto Integrado · Evaluación 3 · INACAP · 18 de noviembre de 2026", options: { fontSize: 17 } },
  ], { placeholder: "body" });
  s.addShape(pres.shapes.OVAL, { x: 9.55, y: 1.65, w: 3.2, h: 3.2, fill: { color: HEX.verde }, line: { type: "none" }, objectName: "Círculo del logo" });
  s.addImage({ data: await icono(gi.GiCow, "FFFFFF"), x: 10.25, y: 2.35, w: 1.8, h: 1.8, objectName: "Ícono de vaca", altText: "Ícono de vaca" });
  s.addNotes("Presentación del equipo. Moncopulli es una lechería de Puyehue. Construimos un sistema para registrar tratamientos, controlar el stock de medicamentos por lote y responder al SAG con trazabilidad completa. Recorremos la presentación en el mismo orden que la rúbrica.");

  // =============================================== 2 PROBLEMA
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Inicio" });
  titulo(s, "El problema: el predio anotaba todo a mano", W - 2 * M);
  const prob = [
    [fa.FaBoxes, "El stock no cuadra", "Cuadernos, planillas y WhatsApp: nadie descontaba el frasco usado."],
    [fa.FaSearch, "Sin trazabilidad", "Responder al SAG qué recibió un animal, de qué lote y quién lo aplicó tomaba días."],
    [gi.GiMilkCarton, "Riesgo en la leche", "El resguardo de leche tras un antibiótico se calculaba a mano."],
  ];
  for (let i = 0; i < 3; i++) {
    const x = M + i * 4.1, y = 1.7;
    tarjeta(s, x, y, 3.8, 3.6, "Tarjeta problema " + (i + 1));
    await circulo(s, prob[i][0], x + 0.35, y + 0.4, 1.0, HEX.verde, "FFFFFF", "Ícono " + prob[i][1]);
    sub(s, prob[i][1], x + 0.35, y + 1.65, 3.1, "Título " + prob[i][1], C.text2, 20);
    texto(s, prob[i][2], x + 0.35, y + 2.2, 3.1, 1.9, "Texto " + prob[i][1], { fontSize: 16 });
  }
  s.addNotes("Tres dolores concretos del cliente. Cada uno se resuelve con una parte del sistema: el stock por lote con movimientos, la trazabilidad con la auditoría y las relaciones de la base, y el resguardo con un cálculo automático al aplicar la dosis.");

  // =============================================== 3 SOLUCIÓN / ARQUITECTURA
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Inicio" });
  titulo(s, "Una base de datos, tres canales", W - 2 * M);
  imgFit(s, "arquitectura.png", M, 1.45, 8.3, 5.2, "Diagrama de arquitectura");
  const canales = [[fa.FaLaptop, "Panel web", "Oficina: administra todo"], [fa.FaMobileAlt, "App Android", "Terreno: funciona sin señal"], [fa.FaTelegramPlane, "Bot de Telegram", "Registro rápido por botones"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.6;
    await circulo(s, canales[i][0], 9.4, y, 0.85, "tinte", HEX.verde, "Ícono " + canales[i][1]);
    sub(s, canales[i][1], 10.45, y + 0.02, 2.4, "Canal " + canales[i][1], C.text2, 18);
    texto(s, canales[i][2], 10.45, y + 0.45, 2.4, 0.6, "Descripción " + canales[i][1], { fontSize: 14, color: C.accent6 });
  }
  s.addNotes("Idea central: ningún canal escribe directo en las tablas. Todos llaman a funciones de la base que revisan el rol, validan, escriben en una transacción y dejan auditoría. Por eso da lo mismo por dónde entre el dato.");

  // =============================================== 4 MAPA RÚBRICA
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Inicio" });
  titulo(s, "Cómo respondemos a la rúbrica", W - 2 * M);
  const mapa = [
    ["Interfaces y negocio", "1 · 2", "13 procesos cubiertos; app rediseñada"],
    ["Base de datos", "3 · 4", "18 tablas, 3FN, 60 índices"],
    ["Seguridad y equipo", "5 · 6", "14 patrones; 7 PR con CI"],
    ["Entorno y documentación", "7 · 8", "Paso a paso + emulador"],
    ["Pruebas", "9 · 10 · 11", "Plan, 3 ciclos y validación"],
    ["Resultados y mejora", "12 · 13", "21 diferencias con causa"],
  ];
  for (let i = 0; i < 6; i++) {
    const col = i % 3, fila = Math.floor(i / 3), x = M + col * 4.1, y = 1.6 + fila * 2.55;
    tarjeta(s, x, y, 3.8, 2.25, "Bloque " + mapa[i][0]);
    s.addText("Criterios " + mapa[i][1], { x: x + 0.3, y: y + 0.25, w: 3.2, h: 0.35, fontSize: 13, bold: true, color: C.accent2, margin: 0, isTextBox: true, objectName: "Criterios " + mapa[i][0] });
    sub(s, mapa[i][0], x + 0.3, y + 0.65, 3.2, "Tema " + mapa[i][0], C.text2, 20);
    texto(s, mapa[i][2], x + 0.3, y + 1.25, 3.2, 0.8, "Evidencia " + mapa[i][0], { fontSize: 15, color: C.accent6 });
  }
  s.addNotes("Esta es la agenda. Cada bloque responde a criterios de la rúbrica; el informe tiene el mismo mapa al inicio con la sección exacta de cada evidencia. El criterio 14 son estas preguntas y el 15 es el informe final.");

  // =============================================== SECCIÓN A
  pres.addSection({ title: "Interfaces" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Interfaces" });
  s.addText("Interfaces que resuelven el trabajo diario", { placeholder: "title" });
  s.addText("Criterios 3.1.1.1 y 3.1.1.2 · coherencia con el negocio y lineamientos", { placeholder: "body" });

  // 6 PROCESOS → INTERFAZ
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Interfaces" });
  titulo(s, "Cada proceso tiene su pantalla");
  rubrica(s, "Criterio 3.1.1.1");
  imgFit(s, "02_resumen_escritorio.png", M, 1.5, 5.6, 5.1, "Captura del resumen del panel", true);
  const proc = [
    ["13 de 13", "procesos del negocio con interfaz"],
    ["3 canales", "panel, app y bot sobre las mismas reglas"],
    ["9 pantallas", "en el panel, según el rol de cada persona"],
  ];
  for (let i = 0; i < 3; i++) {
    const y = 1.55 + i * 1.35;
    s.addText(proc[i][0], { x: 6.7, y, w: 2.6, h: 0.9, fontSize: 36, bold: true, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: "Cifra " + proc[i][0], fontFace: THEME.headFontFace });
    texto(s, proc[i][1], 9.4, y + 0.18, 3.3, 0.7, "Texto cifra " + proc[i][0], { fontSize: 15 });
  }
  texto(s, "Recibir medicamentos, ajustar stock, aplicar dosis, ver el resguardo de leche, anular, crear cuentas y responder al SAG: todo tiene una ruta clara para quien lo necesita.", 6.7, 5.65, 6.0, 1.0, "Resumen de procesos", { fontSize: 15, color: C.accent6 });
  s.addNotes("La matriz completa está en la sección 4.1 del informe. Los botones aparecen según el rol, pero quien autoriza de verdad es la base de datos.");

  // 7 APP V2
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Interfaces" });
  titulo(s, "App móvil v2 para el terreno");
  rubrica(s, "Criterio 3.1.1.2");
  imgFit(s, "app_v2_a.png", M, 1.45, 7.2, 5.25, "Capturas de la app v2", true);
  const app = [
    "Resumen del día arriba: lo atrasado se ve primero",
    "Tarjetas con DIIO y medicamento a todo el ancho",
    "Con fuente al máximo los botones se apilan (DEF-02 corregido)",
    "Mismo verde, logo y tipografía que el panel",
    "Funciona sin señal: guarda y envía después",
  ];
  s.addText(vinetas(app), { x: 8.2, y: 1.6, w: 4.5, h: 4.8, fontSize: 16, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Cambios del rediseño" });
  s.addNotes("Las capturas no son maquetas: las genera una prueba automática que dibuja las pantallas reales. El rediseño cambió solo la interfaz; la lógica probada en los ciclos 1 y 2 se mantuvo.");

  // =============================================== SECCIÓN B
  pres.addSection({ title: "Base de datos" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Base de datos" });
  s.addText("Una base que se defiende sola", { placeholder: "title" });
  s.addText("Criterios 3 y 4 · estructura, normalización y optimización", { placeholder: "body" });

  // 9 ER
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Base de datos" });
  titulo(s, "Modelo real de Supabase");
  rubrica(s, "Criterio 3 · Estructura");
  imgFit(s, "er_general.png", M, 1.35, 4.6, 5.35, "Diagrama ER general");
  const bd = [["18", "tablas con RLS"], ["30", "relaciones"], ["60", "índices (7 parciales)"], ["16", "migraciones en producción"]];
  for (let i = 0; i < 4; i++) {
    const col = i % 2, fila = Math.floor(i / 2), x = 5.75 + col * 3.55, y = 1.55 + fila * 1.75;
    tarjeta(s, x, y, 3.25, 1.5, "Cifra BD " + bd[i][1]);
    s.addText(bd[i][0], { x: x + 0.3, y: y + 0.15, w: 2.7, h: 0.75, fontSize: 40, bold: true, color: C.accent1, margin: 0, isTextBox: true, objectName: "Número " + bd[i][1], fontFace: THEME.headFontFace });
    texto(s, bd[i][1], x + 0.3, y + 0.92, 2.7, 0.45, "Etiqueta " + bd[i][1], { fontSize: 14, color: C.accent6 });
  }
  texto(s, "Trazabilidad SAG: animal → tratamiento → dosis → lote → medicamento, con quién la aplicó y su movimiento de stock.", 5.75, 5.2, 6.8, 1.2, "Cadena de trazabilidad", { fontSize: 16 });
  s.addNotes("El diagrama se generó leyendo la base de producción, no es un dibujo teórico. Las claves foráneas compuestas impiden descontar de un lote de otro medicamento.");

  // 10 NORMALIZACIÓN
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Base de datos" });
  titulo(s, "3FN con dos excepciones a propósito");
  rubrica(s, "Criterio 4 · Normalización");
  const nf = [["1FN", "Las dosis son filas, no una lista dentro del tratamiento"], ["2FN", "El lote tiene su tabla; no se repite el vencimiento en cada movimiento"], ["3FN", "El nombre del medicamento vive solo en su tabla"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.6 + i * 1.15;
    s.addShape(pres.shapes.OVAL, { x: M, y, w: 0.85, h: 0.85, fill: { color: C.accent1 }, line: { type: "none" }, objectName: "Círculo " + nf[i][0] });
    s.addText(nf[i][0], { x: M, y, w: 0.85, h: 0.85, fontSize: 15, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Etiqueta " + nf[i][0] });
    texto(s, nf[i][1], M + 1.1, y + 0.15, 5.0, 0.7, "Regla " + nf[i][0], { fontSize: 16 });
  }
  tarjeta(s, 7.0, 1.55, 5.73, 2.4, "Excepciones controladas");
  sub(s, "Excepciones controladas", 7.3, 1.75, 5.1, "Título excepciones", C.accent2, 18);
  s.addText(vinetas(["stock_actual: un trigger lo mantiene igual a la suma de lotes", "fin_resguardo_leche: dato histórico que no debe cambiar"]), { x: 7.3, y: 2.25, w: 5.2, h: 1.6, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Lista excepciones" });
  tarjeta(s, 7.0, 4.2, 5.73, 2.4, "Optimización");
  sub(s, "Optimización", 7.3, 4.4, 5.1, "Título optimización", C.accent2, 18);
  s.addText(vinetas(["Índices parciales: una sola alerta abierta por objeto", "Triggers: stock y movimiento en la misma transacción", "pg_cron: alertas cada hora sin otro servidor"]), { x: 7.3, y: 4.9, w: 5.2, h: 1.6, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Lista optimización" });
  imgFit(s, "estados_dosis.png", M, 5.15, 6.0, 1.5, "Ciclo de vida de una dosis");
  s.addNotes("Si preguntan por qué guardamos stock_actual: para consultarlo al instante; un trigger lo calcula y otro impide escribirlo a mano.");

  // =============================================== SECCIÓN C
  pres.addSection({ title: "Seguridad y equipo" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Seguridad y equipo" });
  s.addText("Seguridad en capas y trabajo en equipo", { placeholder: "title" });
  s.addText("Criterios 3.1.3.5 y 3.1.3.6", { placeholder: "body" });

  // 12 SEGURIDAD
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Seguridad y equipo" });
  titulo(s, "Seguridad en varias capas");
  rubrica(s, "Criterio 3.1.3.5");
  imgFit(s, "escritura_segura.png", M, 1.35, 4.9, 5.3, "Diagrama de escritura segura");
  const seg = [
    [fa.FaUserLock, "Permiso en el servidor", "RLS en 18 tablas y funciones que revisan el rol"],
    [fa.FaFingerprint, "Auditoría inmutable", "Solo inserción y huella SHA-256 en cada respaldo"],
    [fa.FaKey, "Secretos fuera del código", "Gitleaks en cada PR; el APK no trae la clave privada"],
    [fa.FaShieldAlt, "OWASP Top 10", "ZAP, token falso, XSS, jadx y npm audit sin hallazgos altos"],
  ];
  for (let i = 0; i < 4; i++) {
    const y = 1.5 + i * 1.3;
    await circulo(s, seg[i][0], 5.9, y, 0.8, "tinte", HEX.verde, "Ícono " + seg[i][1]);
    sub(s, seg[i][1], 6.95, y, 5.8, "Patrón " + seg[i][1], C.text2, 17);
    texto(s, seg[i][2], 6.95, y + 0.4, 5.8, 0.55, "Detalle " + seg[i][1], { fontSize: 14, color: C.accent6 });
  }
  s.addNotes("Probado: un operario que llama directo una función de administrador recibe error 42501. La migración 0016 cerró además las funciones internas de trigger. Hallazgo pendiente honesto: el panel publicado aún no envía cabeceras de seguridad (HALL-03).");

  // 13 EQUIPO
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Seguridad y equipo" });
  titulo(s, "Scrumban, pull requests y CI");
  rubrica(s, "Criterio 3.1.3.6");
  const roles = [["Andy Timbles", "Base de datos, panel, bot, CI y respaldo"], ["Liliana Bravo", "App Android y sus 3 ciclos de pruebas"], ["Catalina Pérez", "Modelo de datos y QA del panel"], ["Cristóbal Jara", "Caja blanca, caja negra y red"]];
  for (let i = 0; i < 4; i++) {
    const x = M + i * 3.1;
    tarjeta(s, x, 1.55, 2.85, 1.55, "Rol " + roles[i][0]);
    sub(s, roles[i][0], x + 0.25, 1.75, 2.4, "Nombre " + roles[i][0], C.text2, 17);
    texto(s, roles[i][1], x + 0.25, 2.2, 2.4, 1.1, "Rol de " + roles[i][0], { fontSize: 14, color: C.accent6 });
  }
  imgFit(s, "ci_respaldo.png", M, 3.75, W - 2 * M, 1.6, "Flujo de trabajo y CI");
  texto(s, "7 pull requests fusionados con 4 revisiones automáticas en verde (bot, panel, Android, secretos) · más de 110 commits con formato tipo: descripción", M, 5.75, W - 2 * M, 0.8, "Evidencia de colaboración", { fontSize: 16 });
  s.addNotes("Cada integrante tuvo un área. Todo entró por pull request y pasó la integración continua. Usamos asistentes de IA como apoyo y lo declaramos en el informe: todo pasó por revisión del equipo.");

  // =============================================== SECCIÓN D
  pres.addSection({ title: "Entorno" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Entorno" });
  s.addText("Entorno reproducible y documentado", { placeholder: "title" });
  s.addText("Criterios 3.1.4.7 y 3.1.4.8", { placeholder: "body" });

  // 15 HERRAMIENTAS
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Entorno" });
  titulo(s, "Herramientas usadas y reemplazadas");
  rubrica(s, "Criterio 3.1.4.7");
  imgFit(s, "stack_capas.png", M, 1.4, 7.3, 2.6, "Herramientas por capa");
  s.addTable([
    [{ text: "Antes", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }, { text: "Ahora", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }, { text: "Por qué", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }],
    ["JMeter desde un PC", "k6 en GitHub Actions", "p95 variaba 118–6 709 ms"],
    ["Vistas v_*", "Consultas con RLS", "Las vistas saltaban el RLS"],
    ["Firebase", "Supabase único", "Datos relacionales"],
    ["Flutter / iOS", "Android nativo", "Sin Mac; app ya probada"],
  ], { x: M, y: 4.25, w: 7.3, colW: [2.2, 2.3, 2.8], fontSize: 13, color: HEX.verdeOsc, border: { type: "solid", color: HEX.borde, pt: 0.75 }, rowH: 0.42, objectName: "Tabla de herramientas reemplazadas" });
  tarjeta(s, 8.3, 1.4, 4.43, 5.25, "Instalación paso a paso");
  sub(s, "Instalación en 7 pasos", 8.6, 1.6, 3.9, "Título instalación", C.text2, 18);
  s.addText(["Clonar el repositorio", "Base: db push 0001–0016", "Panel: npm ci y deploy", "Bot: secretos y deploy", "Alta de usuarios", "APK por cable o emulador", "Verificar 401 / 403"].map((t, i, a) => ({ text: t, options: { bullet: { type: "number" }, breakLine: i < a.length - 1, paraSpaceAfter: 6 } })), { x: 8.6, y: 2.1, w: 3.95, h: 4.3, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Lista de pasos" });
  s.addNotes("El informe tiene 14 reemplazos con motivo y evidencia (sección 3.2). La instalación está paso a paso en la sección 7 y el emulador para Windows se instala con un doble clic.");

  // 16 DOCUMENTACIÓN
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Entorno" });
  titulo(s, "Documentación para repetirlo");
  rubrica(s, "Criterio 3.1.4.8");
  const docs = [[fa.FaBook, "Manual técnico", "Instalación, reglas, despliegue, respaldo"], [fa.FaUserFriends, "Manual de usuario", "Qué puede hacer cada rol"], [fa.FaMobileAlt, "README de la app", "Compilar, firmar e instalar"], [fa.FaDatabase, "Migraciones comentadas", "16 archivos, cada uno con su prueba"], [fa.FaProjectDiagram, "Diagramas editables", "draw.io y generados desde la base"], [fa.FaClipboardCheck, "Planillas de pruebas", "Esperado, obtenido y evidencia"]];
  for (let i = 0; i < 6; i++) {
    const col = i % 3, fila = Math.floor(i / 3), x = M + col * 4.1, y = 1.6 + fila * 2.55;
    tarjeta(s, x, y, 3.8, 2.25, "Documento " + docs[i][1]);
    await circulo(s, docs[i][0], x + 0.3, y + 0.3, 0.8, HEX.verde, "FFFFFF", "Ícono " + docs[i][1]);
    sub(s, docs[i][1], x + 0.3, y + 1.25, 3.3, "Título " + docs[i][1], C.text2, 17);
    texto(s, docs[i][2], x + 0.3, y + 1.65, 3.3, 0.5, "Detalle " + docs[i][1], { fontSize: 14, color: C.accent6 });
  }
  s.addNotes("Todo está en el repositorio y en el RAR final. Si cambia el esquema, se agrega una migración nueva con su prueba; nunca se edita una ya aplicada.");

  // =============================================== SECCIÓN E
  pres.addSection({ title: "Pruebas" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Pruebas" });
  s.addText("Sin evidencia no hay prueba aprobada", { placeholder: "title" });
  s.addText("Criterios 3.1.5.9, 3.1.5.10 y 3.1.5.11 · plan, ejecución y validación", { placeholder: "body" });

  // 18 PLAN
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Pruebas" });
  titulo(s, "Plan que cubre cada caso de uso");
  rubrica(s, "Criterio 3.1.5.9");
  imgFit(s, "niveles_prueba.png", M, 1.4, 6.6, 4.95, "Niveles del plan de pruebas");
  s.addText(vinetas([
    "Cada caso de uso tiene al menos 3 pruebas",
    "Borde: DIIO de 8 dígitos, cantidad 0, fechas futuras",
    "Estrés: hasta 400 usuarios y 20 registros sin señal",
    "Seguridad: XSS, token falso, RLS y revisión del APK",
    "Criterios de aceptación fijados antes de ejecutar",
  ]), { x: 7.6, y: 1.6, w: 5.1, h: 4.8, fontSize: 16, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Cobertura del plan" });
  s.addNotes("Técnicas: caja blanca, caja negra, valores límite, partición de equivalencia, estrés, seguridad, regresión y usabilidad. La matriz caso de uso por canal está en la sección 9.3.");

  // 19 EJECUCIÓN (gráfico)
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Pruebas" });
  titulo(s, "Ejecución documentada");
  rubrica(s, "Criterio 3.1.5.10");
  const cats = ["Bot (node:test)", "Panel unitarias", "App JUnit + Room", "SQL en producción", "Panel E2E", "App manual", "Ciclo 3 app v2"];
  const pasan = [34, 35, 32, 32, 26, 36, 13];
  s.addChart(pres.charts.BAR, [{ name: "Pruebas que pasan", labels: cats, values: pasan }], {
    x: M, y: 1.4, w: 7.4, h: 5.2, barDir: "bar", chartColors: [HEX.verde], showValue: true, dataLabelPosition: "outEnd",
    dataLabelColor: HEX.verdeOsc, dataLabelFontSize: 12, dataLabelFontFace: "+mn-lt",
    catAxisLabelColor: HEX.gris, catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valAxisHidden: true,
    valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, catAxisOrientation: "maxMin",
    showTitle: true, title: "Pruebas que pasan por componente", titleFontSize: 14, titleColor: HEX.verdeOsc, titleFontFace: "+mn-lt",
    objectName: "Gráfico de pruebas por componente",
  });
  tarjeta(s, 8.4, 1.5, 4.33, 5.05, "Protocolo de ejecución");
  sub(s, "Protocolo", 8.7, 1.7, 3.8, "Título protocolo", C.text2, 18);
  s.addText(vinetas(["Entorno separado con datos [FALSO]", "Versión anotada por commit", "Resultado exacto + captura", "Defecto o mejora registrado", "Regresión tras cada corrección"]), { x: 8.7, y: 2.2, w: 3.85, h: 3.2, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Pasos del protocolo" });
  texto(s, "Única falla: MOV-37 (visual, baja)", 8.7, 5.75, 3.85, 0.6, "Nota de falla", { fontSize: 14, color: C.accent4, bold: true });
  s.addNotes("App manual: 36 de 37 ejecutados pasan; el que no pasó era visual (DEF-02) y se corrigió en la v2. El ciclo 3 se hizo con un Chrome automatizado contra producción y se verificó en la base.");

  // 20 VALIDACIÓN
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Pruebas" });
  titulo(s, "Resultados comprobados dos veces");
  rubrica(s, "Criterio 3.1.5.11");
  imgFit(s, "C3-12_auditoria.png", M, 1.4, 6.4, 4.4, "Auditoría con origen APPMOVIL", true);
  texto(s, "Ciclo 3: cada acción de la app quedó en la auditoría con origen APPMOVIL", M, 5.95, 6.4, 0.6, "Leyenda auditoría", { fontSize: 13, color: C.accent6, italic: true });
  const val = [["7 de 9", "criterios de aceptación cumplidos; 2 parciales"], ["0", "duplicados: 20 registros sin señal, 20 distintos"], ["20 → 14", "stock exacto tras el ciclo 3 (2 + 1 + 2 + 1)"]];
  for (let i = 0; i < 3; i++) {
    const y = 1.5 + i * 1.6;
    s.addText(val[i][0], { x: 7.4, y, w: 2.6, h: 0.9, fontSize: 34, bold: true, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: "Cifra validación " + i, fontFace: THEME.headFontFace });
    texto(s, val[i][1], 10.0, y + 0.12, 2.73, 0.9, "Texto validación " + i, { fontSize: 15 });
  }
  texto(s, "Pendiente: validar 4 reglas con operarios del predio", 7.4, 6.0, 5.3, 0.5, "Pendiente de validación", { fontSize: 14, color: C.accent2, bold: true });
  s.addNotes("Validar no es ver verde: cruzamos cada caso con el panel y con SQL. La validación con el cliente (entrevistas) es lo único que falta y está declarado.");

  // =============================================== SECCIÓN F
  pres.addSection({ title: "Resultados" });
  s = pres.addSlide({ masterName: "SECCION", sectionTitle: "Resultados" });
  s.addText("Lo que falló, por qué y qué hicimos", { placeholder: "title" });
  s.addText("Criterios 3.1.6.12 y 3.1.6.13 · comparación y recomendaciones", { placeholder: "body" });

  // 22 ESPERADO VS OBTENIDO
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Resultados" });
  titulo(s, "21 diferencias, 18 corregidas");
  rubrica(s, "Criterio 3.1.6.12");
  s.addChart(pres.charts.DOUGHNUT, [{ name: "Diferencias", labels: ["Corregidas", "Comportamiento esperado", "Pendiente de entorno", "Abierta"], values: [18, 1, 1, 1] }], {
    x: M, y: 1.4, w: 5.0, h: 5.0, holeSize: 60, chartColors: [HEX.verde, HEX.claro, HEX.ambar, HEX.rojo], showLegend: true, legendPos: "b",
    legendFontSize: 12, legendFontFace: "+mn-lt", legendColor: HEX.gris, showValue: true, showPercent: false, dataLabelColor: "FFFFFF", dataLabelFontSize: 13, dataLabelFontFace: "+mn-lt",
    showTitle: false, objectName: "Gráfico de diferencias",
  });
  s.addTable([
    [{ text: "Esperado", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }, { text: "Obtenido", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }, { text: "Causa → acción", options: { bold: true, color: "FFFFFF", fill: { color: HEX.verde } } }],
    ["p95 estable < 500 ms", "118 a 6 709 ms", "Red del PC → k6 en Actions"],
    ["Importación auditada", "No auditaba", "Faltaba en el código → 0011"],
    ["Texto legible al máximo", "DIIO cortado", "Columna fija → app v2"],
    ["Producción con 0001–0015", "Solo 0001–0013", "PR sin fusionar → aplicadas"],
  ], { x: 6.0, y: 1.6, w: 6.73, colW: [2.1, 1.9, 2.73], fontSize: 13, color: HEX.verdeOsc, border: { type: "solid", color: HEX.borde, pt: 0.75 }, rowH: 0.55, objectName: "Tabla de diferencias" });
  texto(s, "Ninguna diferencia perdió o duplicó datos ni permitió una acción no autorizada.", 6.0, 5.0, 6.73, 0.9, "Lectura de las diferencias", { fontSize: 16, bold: true, color: C.text2 });
  s.addNotes("El patrón más repetido fue que lo desplegado o lo documentado no coincidía con el código. Por eso ahora comparamos historial local y remoto y re-ejecutamos antes de cada entrega.");

  // 23 RECOMENDACIONES
  s = pres.addSlide({ masterName: "CONTENIDO", sectionTitle: "Resultados" });
  titulo(s, "Recomendaciones con cierre");
  rubrica(s, "Criterio 3.1.6.13");
  const rec = [
    ["Alta", HEX.rojo, "Validar con operarios las 4 reglas de la prueba de uso", "Tabla de entrevistas completa"],
    ["Alta", HEX.rojo, "Excluir caché y sesión de la copia entre dispositivos", "Prueba de transferencia sin datos"],
    ["Media", HEX.ambar, "Cabeceras de seguridad en el panel (HALL-03)", "CP-09 con todas las cabeceras"],
    ["Media", HEX.ambar, "Cifrar sesión y bases locales de la app", "Almacenamiento sin datos legibles"],
    ["Fase 2", HEX.azul, "Monitoreo de cadena de frío 2–8 °C sobre Supabase", "Alerta de temperatura en el panel"],
  ];
  for (let i = 0; i < 5; i++) {
    const y = 1.5 + i * 1.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: y + 0.12, w: 1.3, h: 0.5, rectRadius: 0.25, fill: { color: rec[i][1] }, line: { type: "none" }, objectName: "Prioridad " + i });
    s.addText(rec[i][0], { x: M, y: y + 0.12, w: 1.3, h: 0.5, fontSize: 13, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Texto prioridad " + i });
    texto(s, rec[i][2], M + 1.6, y + 0.12, 6.4, 0.6, "Recomendación " + i, { fontSize: 16, valign: "middle" });
    texto(s, rec[i][3], 8.75, y + 0.12, 3.98, 0.6, "Cierre " + i, { fontSize: 14, color: C.accent6, valign: "middle", italic: true });
  }
  s.addNotes("Ya cerramos R-01 (rediseño), R-03 en su parte AUT-02, R-10 y R-13 (migraciones en producción). Lo que queda tiene dueño y un criterio verificable.");

  // =============================================== CIERRE
  pres.addSection({ title: "Cierre" });
  s = pres.addSlide({ masterName: "PORTADA", sectionTitle: "Cierre" });
  s.addText("Listo para el predio", { placeholder: "title" });
  s.addText([
    { text: "Stock por lote, dosis con resguardo y trazabilidad para el SAG, desde la oficina, el potrero o Telegram.", options: { breakLine: true, fontSize: 20 } },
    { text: " ", options: { breakLine: true, fontSize: 8 } },
    { text: "Próximo paso: piloto con operarios reales.", options: { bold: true, fontSize: 20 } },
    { text: "", options: { breakLine: true } },
    { text: "¿Preguntas?", options: { fontSize: 26, bold: true } },
  ], { placeholder: "body", h: 2.6 });
  s.addShape(pres.shapes.OVAL, { x: 9.55, y: 1.65, w: 3.2, h: 3.2, fill: { color: HEX.verde }, line: { type: "none" }, objectName: "Círculo de cierre" });
  s.addImage({ data: await icono(fa.FaCheck, "FFFFFF"), x: 10.35, y: 2.45, w: 1.6, h: 1.6, objectName: "Ícono de visto bueno", altText: "Visto bueno" });
  s.addNotes("Preguntas probables y respuestas: sección 14 del informe. ¿Qué pasa si un operario intenta anular? 42501. ¿Si se corta la señal? Cola local con uuid, sin duplicados. ¿Por qué Supabase? Reglas en el motor. ¿Qué falta? Entrevistas y 5 pruebas de baja prioridad.");

  await pres.writeFile({ fileName: "Moncopulli_Defensa.pptx" });
  await applyTheme("Moncopulli_Defensa.pptx", THEME);
  console.log("ok");
})().catch((e) => { console.error(e); process.exit(1); });
