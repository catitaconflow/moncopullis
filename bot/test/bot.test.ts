import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interpretar, interpretarLocal } from '../src/interpretar.ts';
import { ErrorUsuario, procesarUpdate, type Dependencias, type Update } from '../src/bot.ts';
import { crearDependencias } from '../src/clientes.ts';
import { manejarWebhook } from '../src/webhook.ts';

test('el lector local separa DIIO, cantidad y medicamento', () => {
  assert.deepEqual(interpretarLocal('apliqué 5 ml de oxitetraciclina a la vaca 123456789'),
    { diio: '123456789', medicamento: 'oxitetraciclina', cantidad: 5 });
  assert.deepEqual(interpretarLocal('123456789 2,5ml Vacuna Triple'),
    { diio: '123456789', medicamento: 'Vacuna Triple', cantidad: 2.5 });
  assert.deepEqual(interpretarLocal('hola'), { diio: null, medicamento: 'hola', cantidad: null });
});

test('si Gemini falla se usa el lector local', async () => {
  const falla = (async () => new Response('x', { status: 500 })) as typeof fetch;
  assert.deepEqual(await interpretar('5 ml de ivermectina 111222333', 'clave', falla),
    { diio: '111222333', medicamento: 'ivermectina', cantidad: 5 });
});

test('Gemini interpreta y el DIIO escrito manda', async () => {
  const gemini = (async () => Response.json({ candidates: [{ content: { parts: [{ text:
    JSON.stringify({ diio: '999999999', medicamento: 'Oxitetraciclina 200', cantidad: 10 }) }] } }] })) as typeof fetch;
  assert.deepEqual(await interpretar('le puse diez de oxi a la 123456789', 'clave', gemini),
    { diio: '123456789', medicamento: 'Oxitetraciclina 200', cantidad: 10 });
});

function falsas(rpc: Dependencias['rpc']) {
  const enviados: { chat: number; texto: string; botones?: unknown }[] = [];
  const editados: string[] = [];
  const d: Dependencias = {
    rpc,
    enviar: async (chat, texto, botones) => { enviados.push({ chat, texto, botones }); },
    editar: async (_c, _m, texto) => { editados.push(texto); },
    responderBoton: async () => undefined,
    interpretar: async (t) => interpretarLocal(t),
  };
  return { d, enviados, editados };
}
const mensaje = (texto: string, update_id = 1): Update =>
  ({ update_id, message: { message_id: 9, chat: { id: 50 }, from: { id: 808 }, text: texto } });

test('/ayuda responde sin consultar la base', async () => {
  const { d, enviados } = falsas(async () => assert.fail('no debe llamar a la base'));
  await procesarUpdate(mensaje('/ayuda'), d);
  assert.match(enviados[0].texto, /Confirmar/);
});

test('un texto libre prepara el registro y ofrece Confirmar y Cancelar', async () => {
  let llamada: Record<string, unknown> = {};
  const funciones: string[] = [];
  const { d, enviados } = falsas(async (fn, args) => {
    funciones.push(fn);
    llamada = { fn, ...args };
    return { mensaje_id: 7, diio: '123456789', categoria: 'VACA', medicamento: 'OXI', cantidad: 5, unidad: 'ML',
             lote: 'L1', vence: '2030-01-31', resguardo_dias: 3 };
  });
  await procesarUpdate(mensaje('5 ml de oxi a la 123456789', 44), d);
  assert.deepEqual(funciones, ['fn_bot_verificar', 'fn_bot_preparar']);
  assert.equal(llamada.p_update, 44);
  assert.equal(llamada.p_diio, '123456789');
  assert.match(enviados[0].texto, /Resguardo de leche: 3 días/);
  assert.deepEqual(enviados[0].botones, [{ texto: 'Confirmar', datos: 'c:7' }, { texto: 'Cancelar', datos: 'x:7' }]);
});

test('Confirmar guarda y muestra el resguardo; Cancelar no guarda', async () => {
  const { d, editados } = falsas(async (_fn, args) =>
    args.p_confirmar ? { estado: 'CONFIRMADO', lote: 'L1', resguardo_hasta: '2030-01-01T12:00:00Z' } : { estado: 'CANCELADO' });
  const boton = (datos: string): Update =>
    ({ update_id: 2, callback_query: { id: 'q', from: { id: 808 }, data: datos, message: { message_id: 9, chat: { id: 50 } } } });
  await procesarUpdate(boton('c:7'), d);
  await procesarUpdate(boton('x:7'), d);
  assert.match(editados[0], /Guardado.*L1[\s\S]*NO entregar leche/);
  assert.match(editados[1], /No se guardó nada/);
});

test('un desconocido no llega a Gemini', async () => {
  let interpreto = false;
  const { d, enviados } = falsas(async () => { throw new ErrorUsuario('Tu cuenta de Telegram no está vinculada.'); });
  d.interpretar = async () => { interpreto = true; return { diio: null, medicamento: null, cantidad: null }; };
  await procesarUpdate(mensaje('hola'), d);
  assert.equal(interpreto, false);
  assert.match(enviados[0].texto, /no está vinculada/);
});

test('los errores de validación se muestran; los demás no', async () => {
  const a = falsas(async () => { throw new ErrorUsuario('No encontré un animal con DIIO 1.'); });
  await procesarUpdate(mensaje('/animal 1'), a.d);
  assert.equal(a.enviados[0].texto, 'No encontré un animal con DIIO 1.');
  const b = falsas(async () => { throw new Error('detalle interno de la base'); });
  await procesarUpdate(mensaje('/stock'), b.d);
  assert.doesNotMatch(b.enviados[0].texto, /detalle interno/);
});

test('el cliente envía la clave del bot y traduce los errores de la base', async () => {
  let cuerpo: Record<string, unknown> = {};
  const respuestas = [
    Response.json([]),
    Response.json({ code: 'P0001', message: 'Falta la cantidad de la dosis.' }, { status: 400 }),
    Response.json({ code: '42501', message: 'Clave del bot inválida.' }, { status: 403 }),
  ];
  const fetcher = (async (_u: string, init: RequestInit) => {
    cuerpo = JSON.parse(String(init.body));
    return respuestas.shift()!;
  }) as unknown as typeof fetch;
  const d = crearDependencias({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', claveBot: 'k', tokenTelegram: 't' }, fetcher);
  await d.rpc('fn_bot_stock', { p_tg: 1 });
  assert.equal(cuerpo.p_clave, 'k');
  await assert.rejects(d.rpc('fn_bot_preparar', {}), (e) => e instanceof ErrorUsuario && /cantidad/.test(e.message));
  await assert.rejects(d.rpc('fn_bot_stock', {}), (e) => !(e instanceof ErrorUsuario));
});

test('el webhook procesa solo updates nuevos', async () => {
  const vistos = new Set<number>();
  let procesados = 0;
  const deps = {
    secretoEsperado: 's',
    registro: { registrar: async (id: number) => (vistos.has(id) ? false : (vistos.add(id), true)) },
    procesar: async () => { procesados++; },
  };
  const req = () => new Request('https://x/telegram/webhook', {
    method: 'POST', headers: { 'X-Telegram-Bot-Api-Secret-Token': 's' }, body: JSON.stringify({ update_id: 5 }) });
  await manejarWebhook(req(), deps);
  await manejarWebhook(req(), deps);
  assert.equal(procesados, 1);
});
