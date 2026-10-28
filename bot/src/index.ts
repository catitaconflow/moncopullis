// Punto de entrada del Worker. El registro de updates vive en un Durable Object:
// una sola instancia guarda los update_id vistos, así la idempotencia vale entre peticiones.
import { manejarWebhook, type RegistroUpdates } from './webhook';
import { importarExportacion } from './importar';
import { conCabecerasSeguridad } from './cabeceras';
import { procesarUpdate, type Update } from './bot';
import { crearDependencias } from './clientes';

interface Entorno {
  TELEGRAM_WEBHOOK_SECRET: string;
  REGISTRO_UPDATES: DurableObjectNamespace;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
  BOT_CLAVE_DB: string;
  GEMINI_API_KEY?: string;
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

async function enrutar(req: Request, env: Entorno, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/telegram/webhook') {
      return manejarWebhook(req, {
        secretoEsperado: env.TELEGRAM_WEBHOOK_SECRET ?? '',
        registro: registroEnDurableObject(env),
        procesar: (u) =>
          procesarUpdate(u as Update, crearDependencias({
            supabaseUrl: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, claveBot: env.BOT_CLAVE_DB,
            tokenTelegram: env.TELEGRAM_BOT_TOKEN, claveGemini: env.GEMINI_API_KEY,
          })),
        enSegundoPlano: (tarea) => ctx.waitUntil(tarea),
      });
    }
    if (url.pathname === '/importar') {
      return importarExportacion(req, { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY });
    }
  return new Response('No encontrado', { status: 404 });
}

export default {
  async fetch(req: Request, env: Entorno, ctx: ExecutionContext): Promise<Response> {
    return conCabecerasSeguridad(await enrutar(req, env, ctx));
  },
};
