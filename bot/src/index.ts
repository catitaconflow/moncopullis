// Punto de entrada del Worker. Las dependencias reales (Supabase) se conectarán
// al implementar RegistroUpdates contra la tabla de updates procesados.
import { manejarWebhook, type RegistroUpdates } from './webhook';

interface Entorno {
  TELEGRAM_WEBHOOK_SECRET: string;
}

// Registro temporal en memoria: solo válido para una instancia. Se reemplaza
// por una tabla en Supabase antes de producción.
function crearRegistroMemoria(): RegistroUpdates {
  const vistos = new Set<number>();
  return {
    async registrar(updateId) {
      if (vistos.has(updateId)) return false;
      vistos.add(updateId);
      return true;
    },
  };
}

const registro = crearRegistroMemoria();

export default {
  async fetch(req: Request, env: Entorno): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/telegram/webhook') {
      return new Response('No encontrado', { status: 404 });
    }
    return manejarWebhook(req, {
      secretoEsperado: env.TELEGRAM_WEBHOOK_SECRET ?? '',
      registro,
    });
  },
};
