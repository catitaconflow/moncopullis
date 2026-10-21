// Cabeceras de seguridad para todas las respuestas del Worker.
// La API no sirve HTML a navegadores, así que la política es la más restrictiva posible.
export const CABECERAS_SEGURIDAD: Readonly<Record<string, string>> = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cache-Control': 'no-store',
};

export function conCabecerasSeguridad(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [nombre, valor] of Object.entries(CABECERAS_SEGURIDAD)) {
    headers.set(nombre, valor);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
