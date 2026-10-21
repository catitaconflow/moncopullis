import { test } from 'node:test';
import assert from 'node:assert/strict';
import { manejarWebhook, secretoValido, type RegistroUpdates } from '../src/webhook.ts';

const SECRETO = 'secreto-de-prueba-largo';

function registroFalso(): RegistroUpdates & { llamadas: number[] } {
  const vistos = new Set<number>();
  const llamadas: number[] = [];
  return {
    llamadas,
    async registrar(id) {
      llamadas.push(id);
      if (vistos.has(id)) return false;
      vistos.add(id);
      return true;
    },
  };
}

function peticion(cuerpo: string, cabeceras: Record<string, string> = {}): Request {
  return new Request('https://bot.test/telegram/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...cabeceras },
    body: cuerpo,
  });
}

test('rechaza con 403 cuando falta el secreto', async () => {
  const res = await manejarWebhook(peticion('{"update_id":1}'), {
    secretoEsperado: SECRETO,
    registro: registroFalso(),
  });
  assert.equal(res.status, 403);
});

test('rechaza con 403 cuando el secreto es incorrecto', async () => {
  const res = await manejarWebhook(
    peticion('{"update_id":1}', { 'X-Telegram-Bot-Api-Secret-Token': 'otro' }),
    { secretoEsperado: SECRETO, registro: registroFalso() },
  );
  assert.equal(res.status, 403);
});

test('no registra nada si el secreto es incorrecto', async () => {
  const registro = registroFalso();
  await manejarWebhook(peticion('{"update_id":1}'), { secretoEsperado: SECRETO, registro });
  assert.deepEqual(registro.llamadas, []);
});

test('rechaza con 403 cuando no hay secreto configurado en el servidor', async () => {
  const res = await manejarWebhook(
    peticion('{"update_id":1}', { 'X-Telegram-Bot-Api-Secret-Token': '' }),
    { secretoEsperado: '', registro: registroFalso() },
  );
  assert.equal(res.status, 403);
});

test('rechaza con 400 un cuerpo que no es JSON', async () => {
  const res = await manejarWebhook(
    peticion('no es json', { 'X-Telegram-Bot-Api-Secret-Token': SECRETO }),
    { secretoEsperado: SECRETO, registro: registroFalso() },
  );
  assert.equal(res.status, 400);
});

test('rechaza con 400 un update sin update_id entero', async () => {
  const res = await manejarWebhook(
    peticion('{"message":{}}', { 'X-Telegram-Bot-Api-Secret-Token': SECRETO }),
    { secretoEsperado: SECRETO, registro: registroFalso() },
  );
  assert.equal(res.status, 400);
});

test('acepta un update válido con el secreto correcto', async () => {
  const res = await manejarWebhook(
    peticion('{"update_id":10}', { 'X-Telegram-Bot-Api-Secret-Token': SECRETO }),
    { secretoEsperado: SECRETO, registro: registroFalso() },
  );
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'Aceptado');
});

test('ignora un update duplicado (idempotencia)', async () => {
  const registro = registroFalso();
  const deps = { secretoEsperado: SECRETO, registro };
  const cabecera = { 'X-Telegram-Bot-Api-Secret-Token': SECRETO };
  await manejarWebhook(peticion('{"update_id":7}', cabecera), deps);
  const segunda = await manejarWebhook(peticion('{"update_id":7}', cabecera), deps);
  assert.equal(segunda.status, 200);
  assert.equal(await segunda.text(), 'Duplicado ignorado');
});

test('rechaza métodos distintos de POST', async () => {
  const res = await manejarWebhook(new Request('https://bot.test/x', { method: 'GET' }), {
    secretoEsperado: SECRETO,
    registro: registroFalso(),
  });
  assert.equal(res.status, 405);
});

test('secretoValido compara sin aceptar prefijos ni vacíos', () => {
  assert.equal(secretoValido(SECRETO, SECRETO), true);
  assert.equal(secretoValido(SECRETO.slice(0, -1), SECRETO), false);
  assert.equal(secretoValido(null, SECRETO), false);
  assert.equal(secretoValido('', ''), false);
});
