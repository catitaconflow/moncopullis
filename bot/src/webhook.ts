// Webhook de Telegram: valida el secreto, descarta duplicados y acepta el update.
// El procesamiento de comandos queda fuera de este módulo.

export interface TelegramUpdate {
  update_id: number;
}

export interface RegistroUpdates {
  // Devuelve true si el update es nuevo y se registró; false si ya existía.
  registrar(updateId: number): Promise<boolean>;
}

export interface Dependencias {
  secretoEsperado: string;
  registro: RegistroUpdates;
}

export function secretoValido(recibido: string | null, esperado: string): boolean {
  if (!recibido || !esperado) return false;
  if (recibido.length !== esperado.length) return false;
  let diferencia = 0;
  for (let i = 0; i < esperado.length; i++) {
    diferencia |= recibido.charCodeAt(i) ^ esperado.charCodeAt(i);
  }
  return diferencia === 0;
}

function esUpdate(valor: unknown): valor is TelegramUpdate {
  return (
    typeof valor === 'object' &&
    valor !== null &&
    Number.isInteger((valor as TelegramUpdate).update_id)
  );
}

export async function manejarWebhook(req: Request, deps: Dependencias): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }

  const recibido = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
  if (!secretoValido(recibido, deps.secretoEsperado)) {
    return new Response('Prohibido', { status: 403 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }

  if (!esUpdate(cuerpo)) {
    return new Response('Update inválido', { status: 400 });
  }

  const esNuevo = await deps.registro.registrar(cuerpo.update_id);
  return new Response(esNuevo ? 'Aceptado' : 'Duplicado ignorado', { status: 200 });
}
