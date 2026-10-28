// Lógica del bot: menú de botones, registro paso a paso con confirmación, comandos y texto libre.
// Las dependencias (base de datos, Telegram, intérprete) llegan desde fuera para poder probarlo sin red.
import type { Interpretacion } from './interpretar.ts';

export class ErrorUsuario extends Error {}

export interface Botones { texto: string; datos: string }
// inline: botones dentro del mensaje (filas); menu: teclado fijo bajo el chat (filas de textos)
export type Teclado = { inline: Botones[][] } | { menu: string[][] };

export interface Dependencias {
  rpc(funcion: string, args: Record<string, unknown>): Promise<unknown>;
  enviar(chat: number, texto: string, teclado?: Teclado): Promise<void>;
  editar(chat: number, mensaje: number, texto: string, inline?: Botones[][]): Promise<void>;
  responderBoton(id: string, texto?: string): Promise<void>;
  interpretar(texto: string): Promise<Interpretacion>;
}

interface Mensaje { message_id: number; chat: { id: number }; from?: { id: number }; text?: string }
export interface Update {
  update_id: number;
  message?: Mensaje;
  callback_query?: { id: string; from: { id: number }; data?: string; message?: Mensaje };
}

export const MENU = { registrar: 'Registrar dosis', stock: 'Stock bajo', animal: 'Consultar animal', ayuda: 'Ayuda' };
const TECLADO_MENU: Teclado = { menu: [[MENU.registrar, MENU.stock], [MENU.animal, MENU.ayuda]] };
const CANTIDADES = [1, 2, 5, 10, 20, 50];
const CANCELAR: Botones = { texto: 'Cancelar', datos: 'x0' };

export const AYUDA = [
  'Bot de registro sanitario de Agrícola Moncopulli.',
  '',
  'Usa los botones de abajo:',
  `• ${MENU.registrar}: eliges animal, medicamento y cantidad, y confirmas.`,
  `• ${MENU.stock}: medicamentos bajo el mínimo.`,
  `• ${MENU.animal}: últimas dosis y resguardo de leche.`,
  '',
  'También puedes escribir, por ejemplo «apliqué 5 ml de oxitetraciclina a la 123456789».',
  'Nada se guarda hasta que pulses Confirmar.',
  '',
  'Para vincular tu cuenta: en el panel pulsa Vincular Telegram y envía aquí /vincular correo código.',
].join('\n');

const fecha = (iso: string): string =>
  new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .replace(/\.$/, '');

const enFilas = <T>(xs: T[], n: number): T[][] => xs.reduce<T[][]>((f, x, i) => (i % n ? f[f.length - 1].push(x) : f.push([x]), f), []);

interface Opciones {
  animales: { diio: string; categoria: string }[];
  medicamentos: { id: number; nombre: string; unidad: string; stock: number }[];
}
interface Resumen { mensaje_id: number; diio: string; categoria: string; medicamento: string; cantidad: number; unidad: string;
                    lote: string; vence: string; resguardo_dias: number }

function textoResumen(r: Resumen): string {
  return [
    'Revisa antes de guardar:',
    `Animal: ${r.diio} (${r.categoria})`,
    `Medicamento: ${r.medicamento}`,
    `Cantidad: ${r.cantidad} ${r.unidad}`,
    `Lote: ${r.lote} (vence ${r.vence})`,
    r.resguardo_dias > 0 ? `Resguardo de leche: ${r.resguardo_dias} días` : 'Sin resguardo de leche',
  ].join('\n');
}
// Panel de opciones con botones grandes: lo que ve quien escribe algo que el bot no entiende
const OPCIONES: Botones[][] = [
  [{ texto: 'Registrar dosis', datos: 'r' }],
  [{ texto: 'Consultar animal', datos: 'va' }, { texto: 'Stock bajo', datos: 's' }],
  [{ texto: 'Ayuda', datos: 'h' }],
];
const mostrarOpciones = (chat: number, d: Dependencias, antes = '¿Qué quieres hacer?') =>
  d.enviar(chat, antes, { inline: OPCIONES });

const botonesConfirmar = (id: number): Botones[][] => [[{ texto: 'Confirmar', datos: `c:${id}` }, { texto: 'Cancelar', datos: `x:${id}` }]];

async function stock(chat: number, tg: number, d: Dependencias): Promise<void> {
  const lista = (await d.rpc('fn_bot_stock', { p_tg: tg })) as { nombre: string; stock: number; minimo: number; unidad: string }[];
  if (!lista.length) return d.enviar(chat, 'Todos los medicamentos están sobre su stock mínimo.');
  return d.enviar(chat, ['Bajo el mínimo:', ...lista.map((m) => `• ${m.nombre}: ${m.stock} de ${m.minimo} ${m.unidad}`)].join('\n'));
}

async function textoAnimal(tg: number, diio: string, soloResguardo: boolean, d: Dependencias): Promise<string> {
  const a = (await d.rpc('fn_bot_animal', { p_tg: tg, p_diio: diio })) as {
    diio: string; categoria: string; de_baja: boolean; resguardo_hasta: string | null;
    ultimas: { fecha: string; medicamento: string; cantidad: number; unidad: string }[];
  };
  const resguardo = a.resguardo_hasta ? `NO entregar leche hasta ${fecha(a.resguardo_hasta)}.` : 'Sin resguardo vigente: puede entregar leche.';
  if (soloResguardo) return `${a.diio}: ${resguardo}`;
  const ultimas = a.ultimas.length ? a.ultimas.map((u) => `• ${fecha(u.fecha)}  ${u.medicamento} ${u.cantidad} ${u.unidad}`) : ['Sin dosis aplicadas.'];
  return [`${a.diio} (${a.categoria}${a.de_baja ? ', de baja' : ''})`, resguardo, '', 'Últimas dosis:', ...ultimas].join('\n');
}

// Paso 1 del registro y de la consulta: botones con los animales
async function elegirAnimal(chat: number, tg: number, prefijo: 'a' | 'v', d: Dependencias): Promise<void> {
  const o = (await d.rpc('fn_bot_opciones', { p_tg: tg })) as Opciones;
  if (!o.animales.length) return d.enviar(chat, 'No hay animales activos con DIIO.');
  const botones = o.animales.map((a) => ({ texto: `${a.diio} ${a.categoria.toLowerCase()}`, datos: `${prefijo}:${a.diio}` }));
  const pregunta = prefijo === 'a' ? '¿A qué animal le aplicaste?' : '¿Qué animal quieres consultar?';
  return d.enviar(chat, `${pregunta}\nSi no aparece, escribe su DIIO.`, { inline: [...enFilas(botones, 2), [CANCELAR]] });
}

async function ofrecerAnimal(chat: number, tg: number, diio: string, d: Dependencias): Promise<void> {
  return d.enviar(chat, await textoAnimal(tg, diio, false, d), { inline: [[{ texto: 'Registrar dosis a este animal', datos: `a:${diio}` }]] });
}

async function comando(chat: number, tg: number, updateId: number, texto: string, d: Dependencias): Promise<void> {
  const [cmd, ...args] = texto.trim().split(/\s+/);
  switch (cmd.toLowerCase().replace(/@.*$/, '')) {
    case '/start':
    case '/ayuda':
    case '/help':
      return d.enviar(chat, AYUDA, TECLADO_MENU);
    case '/vincular': {
      if (args.length < 2) return d.enviar(chat, 'Uso: /vincular correo código');
      const r = await d.rpc('fn_bot_vincular', { p_tg: tg, p_correo: args[0], p_codigo: args[1] });
      return d.enviar(chat, String(r), TECLADO_MENU);
    }
    case '/stock':
      return stock(chat, tg, d);
    case '/animal':
    case '/resguardo':
      if (!args[0]) return elegirAnimal(chat, tg, 'v', d);
      return d.enviar(chat, await textoAnimal(tg, args[0], cmd === '/resguardo', d));
    case '/registrar':
      if (!args.length) return elegirAnimal(chat, tg, 'a', d);
      return registrarTexto(chat, tg, updateId, args.join(' '), d);
    default:
      return mostrarOpciones(chat, d);
  }
}

async function registrarTexto(chat: number, tg: number, updateId: number, texto: string, d: Dependencias): Promise<void> {
  // Primero la vinculación, para no gastar Gemini en mensajes de desconocidos
  await d.rpc('fn_bot_verificar', { p_tg: tg });
  const i = await d.interpretar(texto);
  if (!i.diio || !i.medicamento || !i.cantidad) {
    if (i.diio) return ofrecerAnimal(chat, tg, i.diio, d);
    return mostrarOpciones(chat, d);
  }
  try {
    const r = (await d.rpc('fn_bot_preparar', {
      p_tg: tg, p_chat: chat, p_update: updateId, p_texto: texto,
      p_diio: i.diio, p_medicamento: i.medicamento, p_cantidad: i.cantidad,
    })) as Resumen;
    return d.enviar(chat, textoResumen(r), { inline: botonesConfirmar(r.mensaje_id) });
  } catch (e) {
    if (!(e instanceof ErrorUsuario)) throw e;
    return mostrarOpciones(chat, d, `${e.message}
Puedes hacerlo con los botones:`);
  }
}

async function mensaje(msg: Mensaje & { from: { id: number }; text: string }, updateId: number, d: Dependencias): Promise<void> {
  const { chat: { id: chat }, from: { id: tg }, text } = msg;
  if (text.startsWith('/')) return comando(chat, tg, updateId, text, d);
  if (text === MENU.registrar) return elegirAnimal(chat, tg, 'a', d);
  if (text === MENU.animal) return elegirAnimal(chat, tg, 'v', d);
  if (text === MENU.stock) return stock(chat, tg, d);
  if (text === MENU.ayuda) return d.enviar(chat, AYUDA, TECLADO_MENU);
  // Un DIIO solo: mostrar el animal y ofrecer registrar
  return registrarTexto(chat, tg, updateId, text, d);
}

async function boton(q: NonNullable<Update['callback_query']>, updateId: number, d: Dependencias): Promise<void> {
  if (!q.message) return d.responderBoton(q.id);
  const chat = q.message.chat.id;
  const msg = q.message.message_id;
  const tg = q.from.id;
  const [tipo, ...partes] = (q.data ?? '').split(':');

  if (tipo === 'r' || tipo === 'va' || tipo === 's' || tipo === 'h') {
    await d.responderBoton(q.id);
    if (tipo === 'r') return elegirAnimal(chat, tg, 'a', d);
    if (tipo === 'va') return elegirAnimal(chat, tg, 'v', d);
    if (tipo === 's') return stock(chat, tg, d);
    return d.enviar(chat, AYUDA, TECLADO_MENU);
  }
  if (tipo === 'x0') {
    await d.responderBoton(q.id);
    return d.editar(chat, msg, 'Cancelado. No se guardó nada.', OPCIONES);
  }
  if (tipo === 'v' && partes[0]) {
    await d.responderBoton(q.id);
    return d.editar(chat, msg, await textoAnimal(tg, partes[0], false, d),
      [[{ texto: 'Registrar dosis a este animal', datos: `a:${partes[0]}` }]]);
  }
  if (tipo === 'a' && partes[0]) {
    const o = (await d.rpc('fn_bot_opciones', { p_tg: tg })) as Opciones;
    await d.responderBoton(q.id);
    if (!o.medicamentos.length) return d.editar(chat, msg, 'No hay medicamentos con stock. Registra una entrada en el panel.');
    const botones = o.medicamentos.map((m) => [{ texto: `${m.nombre} (${m.stock} ${m.unidad})`, datos: `m:${partes[0]}:${m.id}` }]);
    return d.editar(chat, msg, `Animal ${partes[0]}.\n¿Qué medicamento aplicaste?`, [...botones, [CANCELAR]]);
  }
  if (tipo === 'm' && partes.length === 2) {
    await d.responderBoton(q.id);
    const botones = CANTIDADES.map((c) => ({ texto: String(c), datos: `q:${partes[0]}:${partes[1]}:${c}` }));
    return d.editar(chat, msg, `Animal ${partes[0]}.\n¿Cuánto aplicaste? (en la unidad del medicamento)\nSi no está la cantidad, escribe el registro completo.`,
      [...enFilas(botones, 3), [CANCELAR]]);
  }
  if (tipo === 'q' && partes.length === 3) {
    const r = (await d.rpc('fn_bot_preparar_id', {
      p_tg: tg, p_chat: chat, p_update: updateId, p_texto: 'Registro con botones',
      p_diio: partes[0], p_medicamento_id: Number(partes[1]), p_cantidad: Number(partes[2]),
    })) as Resumen;
    await d.responderBoton(q.id);
    return d.editar(chat, msg, textoResumen(r), botonesConfirmar(r.mensaje_id));
  }
  if ((tipo === 'c' || tipo === 'x') && /^\d+$/.test(partes[0] ?? '')) {
    const r = (await d.rpc('fn_bot_confirmar', { p_tg: tg, p_mensaje: Number(partes[0]), p_confirmar: tipo === 'c' })) as {
      estado: string; error?: string; lote?: string; resguardo_hasta?: string | null;
    };
    await d.responderBoton(q.id, r.estado === 'CONFIRMADO' ? 'Guardado' : undefined);
    const texto =
      r.estado === 'CONFIRMADO'
        ? `Guardado. Se descontó del lote ${r.lote}.` + (r.resguardo_hasta ? `\nNO entregar leche hasta ${fecha(r.resguardo_hasta)}.` : '')
        : r.estado === 'CANCELADO'
          ? r.error ?? 'Cancelado. No se guardó nada.'
          : `No se pudo guardar: ${r.error}`;
    return d.editar(chat, msg, texto);
  }
  return d.responderBoton(q.id);
}

export async function procesarUpdate(u: Update, d: Dependencias): Promise<void> {
  const chat = u.message?.chat.id ?? u.callback_query?.message?.chat.id;
  try {
    if (u.callback_query) return await boton(u.callback_query, u.update_id, d);
    const msg = u.message;
    if (!msg?.text || !msg.from) return;
    return await mensaje(msg as Mensaje & { from: { id: number }; text: string }, u.update_id, d);
  } catch (e) {
    if (chat === undefined) return;
    if (u.callback_query) await d.responderBoton(u.callback_query.id).catch(() => undefined);
    await d.enviar(chat, e instanceof ErrorUsuario ? e.message : 'Ocurrió un error. Intenta de nuevo en un momento.');
  }
}
