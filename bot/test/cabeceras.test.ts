import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conCabecerasSeguridad, CABECERAS_SEGURIDAD } from '../src/cabeceras.ts';

test('agrega todas las cabeceras de seguridad a una respuesta', () => {
  const res = conCabecerasSeguridad(new Response('ok', { status: 200 }));
  for (const [nombre, valor] of Object.entries(CABECERAS_SEGURIDAD)) {
    assert.equal(res.headers.get(nombre), valor, nombre);
  }
});

test('conserva el estado y el cuerpo de la respuesta original', async () => {
  const res = conCabecerasSeguridad(new Response('no autorizado', { status: 401 }));
  assert.equal(res.status, 401);
  assert.equal(await res.text(), 'no autorizado');
});

test('sobrescribe una cabecera que el handler ya había puesto', () => {
  const original = new Response(null, { status: 200, headers: { 'Cache-Control': 'public' } });
  assert.equal(conCabecerasSeguridad(original).headers.get('Cache-Control'), 'no-store');
});
