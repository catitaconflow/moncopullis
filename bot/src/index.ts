// Punto de entrada del Worker. El registro de updates vive en un Durable Object:
// una sola instancia guarda los update_id vistos, así la idempotencia vale entre peticiones.
import { manejarWebhook, type RegistroUpdates } from './webhook';

interface Entorno {
  TELEGRAM_WEBHOOK_SECRET: string;
  REGISTRO_UPDATES: DurableObjectNamespace;
}

export class RegistroUpdatesDO {
  constructor(private readonly estado: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const { updateId } = (await req.json()) as { updateId: number };
    const clave = `update:${updateId}`;
    if (await this.estado.storage.get(clave)) {
      return Response.json({ nuevo: false });
    }
    await this.estado.storage.put(clave, Date.now());
    return Response.json({ nuevo: true });
  }
}

function registroEnDurableObject(env: Entorno): RegistroUpdates {
  const stub = env.REGISTRO_UPDATES.get(env.REGISTRO_UPDATES.idFromName('global'));
  return {
    async registrar(updateId) {
      const res = await stub.fetch('https://registro/registrar', {
        method: 'POST',
        body: JSON.stringify({ updateId }),
      });
      const { nuevo } = (await res.json()) as { nuevo: boolean };
      return nuevo;
    },
  };
}

export default {
  async fetch(req: Request, env: Entorno): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/telegram/webhook') {
      return new Response('No encontrado', { status: 404 });
    }
    return manejarWebhook(req, {
      secretoEsperado: env.TELEGRAM_WEBHOOK_SECRET ?? '',
      registro: registroEnDurableObject(env),
    });
  },
};
