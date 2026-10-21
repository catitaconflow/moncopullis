import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importarExportacion, type FetchFn } from '../src/importar.ts';

const CONFIG = { url: 'https://proyecto.supabase.co', anonKey: 'clave-publica-de-prueba' };
const TOKEN = 'Bearer token-de-sesion-de-prueba';

function peticion(cuerpo: string, cabeceras: Record<string, string> = { Authorization: TOKEN }): Request {
  return new Request('https://bot.test/importar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: cuerpo,
  });
}

function fetchFalso(status: number, cuerpo: string) {
  const llamadas: { url: string; init: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    llamadas.push({ url, init });
    return new Response(cuerpo, { status });
  };
  return { fetchFn, llamadas };
}

test('rechaza con 401 cuando no hay token de sesión, sin llamar a Supabase', async () => {
  const { fetchFn, llamadas } = fetchFalso(200, '{}');
  const res = await importarExportacion(peticion('{}', {}), CONFIG, fetchFn);
  assert.equal(res.status, 401);
  assert.equal(llamadas.length, 0);
});

test('rechaza con 401 un Authorization que no es Bearer', async () => {
  const { fetchFn, llamadas } = fetchFalso(200, '{}');
  const res = await importarExportacion(peticion('{}', { Authorization: 'Basic abc' }), CONFIG, fetchFn);
  assert.equal(res.status, 401);
  assert.equal(llamadas.length, 0);
});

test('rechaza con 405 cuando el método no es POST', async () => {
  const { fetchFn } = fetchFalso(200, '{}');
  const res = await importarExportacion(new Request('https://bot.test/importar', { method: 'GET' }), CONFIG, fetchFn);
  assert.equal(res.status, 405);
});

test('rechaza con 400 un cuerpo que no es JSON', async () => {
  const { fetchFn, llamadas } = fetchFalso(200, '{}');
  const res = await importarExportacion(peticion('no es json'), CONFIG, fetchFn);
  assert.equal(res.status, 400);
  assert.equal(llamadas.length, 0);
});

test('reenvía el export a la función SQL con el token del usuario', async () => {
  const { fetchFn, llamadas } = fetchFalso(200, '{"estado":"importado","cantidad":1}');
  const res = await importarExportacion(peticion('{"export_id":"exp-1","registros":[]}'), CONFIG, fetchFn);

  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0].url, 'https://proyecto.supabase.co/rest/v1/rpc/fn_importar_exportacion');
  const cabeceras = llamadas[0].init.headers as Record<string, string>;
  assert.equal(cabeceras.Authorization, TOKEN);
  assert.equal(cabeceras.apikey, 'clave-publica-de-prueba');
  assert.deepEqual(JSON.parse(llamadas[0].init.body as string), { p_export_id: 'exp-1', p_registros: [] });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"estado":"importado","cantidad":1}');
});

test('devuelve el mismo código que Supabase cuando rechaza (p. ej. 403 para no ADMIN)', async () => {
  const { fetchFn } = fetchFalso(403, '{"message":"Solo ADMIN puede importar"}');
  const res = await importarExportacion(peticion('{"export_id":"exp-2","registros":[]}'), CONFIG, fetchFn);
  assert.equal(res.status, 403);
});
