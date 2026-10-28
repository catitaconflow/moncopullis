// Clientes HTTP del bot: funciones de Supabase (PostgREST) y Bot API de Telegram.
import { ErrorUsuario, type Botones, type Dependencias, type Teclado } from './bot.ts';
import { interpretar } from './interpretar.ts';

export interface ConfigBot {
  supabaseUrl: string;
  anonKey: string;
  claveBot: string;
  tokenTelegram: string;
  claveGemini?: string;
}

export function crearDependencias(c: ConfigBot, fetcher: typeof fetch = fetch): Dependencias {
  const telegram = async (metodo: string, cuerpo: unknown): Promise<void> => {
    const res = await fetcher(`https://api.telegram.org/bot${c.tokenTelegram}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    if (!res.ok) throw new Error(`Telegram ${metodo} respondió ${res.status}`);
  };
  const enLinea = (filas: Botones[][]) => ({ inline_keyboard: filas.map((f) => f.map((x) => ({ text: x.texto, callback_data: x.datos }))) });
  const teclado = (t?: Teclado) =>
    !t ? {} : 'inline' in t
      ? { reply_markup: enLinea(t.inline) }
      : { reply_markup: { keyboard: t.menu.map((f) => f.map((text) => ({ text }))), resize_keyboard: true, is_persistent: true } };

  return {
    async rpc(funcion, args) {
      const res = await fetcher(`${c.supabaseUrl}/rest/v1/rpc/${funcion}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: c.anonKey, Authorization: `Bearer ${c.anonKey}` },
        body: JSON.stringify({ p_clave: c.claveBot, ...args }),
      });
      const datos = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
      if (res.ok) return datos;
      // P0001: validación con mensaje para el usuario; lo demás no se muestra tal cual
      if (datos?.code === 'P0001' && datos.message) throw new ErrorUsuario(datos.message);
      throw new Error(`Supabase ${funcion} respondió ${res.status} ${datos?.code ?? ''}`);
    },
    enviar: (chat, texto, t) => telegram('sendMessage', { chat_id: chat, text: texto, ...teclado(t) }),
    editar: (chat, mensaje, texto, inline) =>
      telegram('editMessageText', { chat_id: chat, message_id: mensaje, text: texto, ...(inline ? { reply_markup: enLinea(inline) } : {}) }),
    responderBoton: (id, texto) => telegram('answerCallbackQuery', { callback_query_id: id, ...(texto ? { text: texto } : {}) }),
    interpretar: (texto) => interpretar(texto, c.claveGemini, fetcher),
  };
}
