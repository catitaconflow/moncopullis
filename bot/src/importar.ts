// Endpoint de importación: reenvía el token de sesión del usuario a la función SQL
// fn_importar_exportacion. La validación y la autorización (solo ADMIN) viven en Supabase,
// así el Worker no necesita una clave privilegiada.

export interface ConfigSupabase {
  url: string;
  anonKey: string;
}

export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

function sinAutorizacion(): Response {
  return new Response('No autorizado', { status: 401 });
}

function tokenDeSesion(req: Request): string | null {
  const cabecera = req.headers.get('Authorization');
  if (!cabecera || !cabecera.startsWith('Bearer ') || cabecera.length <= 'Bearer '.length) {
    return null;
  }
  return cabecera;
}

export async function importarExportacion(
  req: Request,
  config: ConfigSupabase,
  fetchFn: FetchFn = fetch,
): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Método no permitido', { status: 405 });
  }
  const token = tokenDeSesion(req);
  if (!token) return sinAutorizacion();

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return new Response('JSON inválido', { status: 400 });
  }
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return new Response('El cuerpo debe ser un objeto', { status: 400 });
  }

  const { export_id, registros } = cuerpo as { export_id?: unknown; registros?: unknown };
  const res = await fetchFn(`${config.url}/rest/v1/rpc/fn_importar_exportacion`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: config.anonKey,
      Authorization: token,
    },
    body: JSON.stringify({ p_export_id: export_id, p_registros: registros }),
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
