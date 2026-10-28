// Lógica del bot: comandos, registro con confirmación y respuestas.
// Las dependencias (base de datos, Telegram, intérprete) llegan desde fuera para poder probarlo sin red.
import type { Interpretacion } from './interpretar.ts';

export class ErrorUsuario extends Error {}

export interface Botones { texto: string; datos: string }

export interface Dependencias {
  rpc(funcion: string, args: Record<string, unknown>): Promise<unknown>;
  enviar(chat: number, texto: string, botones?: Botones[]): Promise<void>;
  editar(chat: number, mensaje: number, texto: string): Promise<void>;
  responderBoton(id: string, texto?: string): Promise<void>;
  interpretar(texto: string): Promise<Interpretacion>;
}

interface Mensaje { message_id: number; chat: { id: number }; from?: { id: number }; text?: string }
export interface Update {
  update_id: number;
  message?: Mensaje;
  callback_query?: { id: string; from: { id: number }; data?: string; message?: Mensaje };
}

export const AYUDA = [
  'Bot de registro sanitario de Agrícola Moncopulli.',
  '',
  'Registrar una dosis: escribe lo que aplicaste, por ejemplo',
  '«apliqué 5 ml de oxitetraciclina a la 123456789».',
  'Te mostraré un resumen y nada se guarda hasta que pulses Confirmar.',
  '',
  '/stock  medicamentos bajo el mínimo',
  '/animal DIIO  últimas dosis del animal',
  '/resguardo DIIO  si la vaca puede entregar leche',
  '/vincular correo código  vincular tu cuenta (el código te lo da el administrador)',
  '/ayuda  esta ayuda',
].join('\n');

const fecha = (iso: string): string =>
  new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

async function comando(chat: number, tg: number, updateId: number, texto: string, d: Dependencias): Promise<void> {
  const [cmd, ...args] = texto.trim().split(/\s+/);
  switch (cmd.toLowerCase().replace(/@.*$/, '')) {
    case '/start':
    case '/ayuda':
    case '/help':
      return d.enviar(chat, AYUDA);
    case '/vincular': {
      if (args.length < 2) return d.enviar(chat, 'Uso: /vincular correo código');
      const r = await d.rpc('fn_bot_vincular', { p_tg: tg, p_correo: args[0], p_codigo: args[1] });
      return d.enviar(chat, String(r));
    }
    case '/stock': {
      const lista = (await d.rpc('fn_bot_stock', { p_tg: tg })) as { nombre: string; stock: number; minimo: number; unidad: string }[];
      if (!lista.length) return d.enviar(chat, 'Todos los medicamentos están sobre su stock mínimo.');
      return d.enviar(chat, ['Bajo el mínimo:', ...lista.map((m) => `• ${m.nombre}: ${m.stock} de ${m.minimo} ${m.unidad}`)].join('\n'));
    }
    case '/animal':
    case '/resguardo': {
      if (!args[0]) return d.enviar(chat, `Uso: ${cmd} DIIO`);
      const a = (await d.rpc('fn_bot_animal', { p_tg: tg, p_diio: args[0] })) as {
        diio: string; categoria: string; de_baja: boolean; resguardo_hasta: string | null;
        ultimas: { fecha: string; medicamento: string; cantidad: number; unidad: string }[];
      };
      const resguardo = a.resguardo_hasta
        ? `NO entregar leche hasta ${fecha(a.resguardo_hasta)}.`
        : 'Sin resguardo vigente: puede entregar leche.';
      if (cmd === '/resguardo') return d.enviar(chat, `${a.diio}: ${resguardo}`);
      const ultimas = a.ultimas.length
        ? a.ultimas.map((u) => `• ${fecha(u.fecha)}  ${u.medicamento} ${u.cantidad} ${u.unidad}`)
        : ['Sin dosis aplicadas.'];
      return d.enviar(chat, [`${a.diio} (${a.categoria}${a.de_baja ? ', de baja' : ''})`, resguardo, '', 'Últimas dosis:', ...ultimas].join('\n'));
    }
    case '/registrar':
      return registrar(chat, tg, updateId, args.join(' '), d);
    default:
      return d.enviar(chat, 'No conozco ese comando. Envía /ayuda.');
  }
}

async function registrar(chat: number, tg: number, updateId: number, texto: string, d: Dependencias): Promise<void> {
  if (!texto.trim()) return d.enviar(chat, 'Escribe lo que aplicaste, por ejemplo «5 ml de oxitetraciclina a la 123456789».');
  const i = await d.interpretar(texto);
  const r = (await d.rpc('fn_bot_preparar', {
    p_tg: tg, p_chat: chat, p_update: updateId, p_texto: texto,
    p_diio: i.diio, p_medicamento: i.medicamento, p_cantidad: i.cantidad,
  })) as { mensaje_id: number; diio: string; categoria: string; medicamento: string; cantidad: number; unidad: string;
           lote: string; vence: string; resguardo_dias: number };
  const resumen = [
    'Revisa antes de guardar:',
    `Animal: ${r.diio} (${r.categoria})`,
    `Medicamento: ${r.medicamento}`,
    `Cantidad: ${r.cantidad} ${r.unidad}`,
    `Lote: ${r.lote} (vence ${r.vence})`,
    r.resguardo_dias > 0 ? `Resguardo de leche: ${r.resguardo_dias} días` : 'Sin resguardo de leche',
  ].join('\n');
  return d.enviar(chat, resumen, [
    { texto: 'Confirmar', datos: `c:${r.mensaje_id}` },
    { texto: 'Cancelar', datos: `x:${r.mensaje_id}` },
  ]);
}

async function boton(q: NonNullable<Update['callback_query']>, d: Dependencias): Promise<void> {
  const m = /^([cx]):(\d+)$/.exec(q.data ?? '');
  if (!m || !q.message) return d.responderBoton(q.id);
  const r = (await d.rpc('fn_bot_confirmar', { p_tg: q.from.id, p_mensaje: Number(m[2]), p_confirmar: m[1] === 'c' })) as {
    estado: string; error?: string; lote?: string; resguardo_hasta?: string | null;
  };
  await d.responderBoton(q.id, r.estado === 'CONFIRMADO' ? 'Guardado' : undefined);
  const texto =
    r.estado === 'CONFIRMADO'
      ? `Guardado. Se descontó del lote ${r.lote}.` + (r.resguardo_hasta ? `\nNO entregar leche hasta ${fecha(r.resguardo_hasta)}.` : '')
      : r.estado === 'CANCELADO'
        ? r.error ?? 'Cancelado. No se guardó nada.'
        : `No se pudo guardar: ${r.error}`;
  return d.editar(q.message.chat.id, q.message.message_id, texto);
}

export async function procesarUpdate(u: Update, d: Dependencias): Promise<void> {
  const chat = u.message?.chat.id ?? u.callback_query?.message?.chat.id;
  try {
    if (u.callback_query) return await boton(u.callback_query, d);
    const msg = u.message;
    if (!msg?.text || !msg.from) return;
    if (msg.text.startsWith('/')) return await comando(msg.chat.id, msg.from.id, u.update_id, msg.text, d);
    return await registrar(msg.chat.id, msg.from.id, u.update_id, msg.text, d);
  } catch (e) {
    if (chat === undefined) return;
    if (u.callback_query) await d.responderBoton(u.callback_query.id).catch(() => undefined);
    await d.enviar(chat, e instanceof ErrorUsuario ? e.message : 'Ocurrió un error. Intenta de nuevo en un momento.');
  }
}
