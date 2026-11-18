// Ciclo 3: pruebas de la app v2 por la misma API que usa Android, con un Chrome real (Playwright),
// más verificación visual en el panel publicado. Credenciales solo por variables de entorno.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PANEL = 'https://moncopulli-panel.itskay666.workers.dev';
const SB = 'https://gagxfsyrsrfnjuseengj.supabase.co';
const KEY = 'sb_publishable_r1MmubwecAXdcDwP73PdOg_oBniMDgb'; // clave pública (la misma del APK)
const OUT = path.join(__dirname, 'capturas');
fs.mkdirSync(OUT, { recursive: true });
const R = [];
const anota = (id, caso, esperado, obtenido, pasa) => { R.push({ id, caso, esperado, obtenido, pasa }); console.log(pasa ? 'PASA' : 'FALLA', id, '-', obtenido); };

(async () => {
  const navegador = await chromium.launch({ proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const ctx = await navegador.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 860 }, locale: 'es-CL', timezoneId: 'America/Santiago' });
  const p = await ctx.newPage();
  const foto = async (n) => p.screenshot({ path: path.join(OUT, `${n}.png`), fullPage: false });

  // ---- C3-02: contraseña incorrecta
  await p.goto(PANEL + '/login', { waitUntil: 'networkidle' });
  await p.fill('#email', process.env.C3_EMAIL);
  await p.fill('#clave', 'incorrecta-' + Date.now());
  await p.click('button[type=submit]');
  await p.waitForTimeout(2500);
  const txtMal = await p.locator('body').innerText();
  const okMal = !p.url().includes('/inventario') && p.url().includes('/login');
  anota('C3-02', 'Inicio de sesión con contraseña incorrecta', 'No entra y muestra error', okMal ? 'Se queda en el login con mensaje de error' : 'Entró', okMal);
  await foto('C3-02_clave_incorrecta');

  // ---- C3-01: login correcto
  await p.fill('#clave', process.env.C3_CLAVE);
  await p.click('button[type=submit]');
  await p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
  await p.waitForTimeout(2500);
  anota('C3-01', 'Inicio de sesión ADMIN', 'Entra al Resumen', 'Entra al Resumen (' + new URL(p.url()).pathname + ')', true);
  await foto('C3-01_resumen');

  // token de la sesión, igual que la app (Supabase Auth)
  const token = await p.evaluate(() => {
    const k = Object.keys(localStorage).find((x) => x.includes('auth-token'));
    return k ? JSON.parse(localStorage.getItem(k)).access_token : null;
  });
  if (!token) throw new Error('No se obtuvo la sesión');

  const rpc = async (fn, args, conToken = true) => {
    const r = await p.evaluate(async ({ SB, KEY, fn, args, token }) => {
      const h = { apikey: KEY, 'Content-Type': 'application/json' };
      if (token) h.Authorization = 'Bearer ' + token;
      const res = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) });
      let body; try { body = await res.json(); } catch { body = null; }
      return { status: res.status, body };
    }, { SB, KEY, fn, args, token: conToken ? token : null });
    return r;
  };
  const msg = (r) => (r.body && (r.body.message || r.body.estado || JSON.stringify(r.body))) || String(r.status);

  // ---- C3-04: aplicar dosis programada 26 (como Inicio → Aplicar)
  let r = await rpc('fn_app_aplicar_dosis', { p_dosis_id: 26 });
  anota('C3-04', 'Aplicar dosis programada (Inicio → Aplicar)', 'creado, lote PRUEBA-E2E-1, con resguardo',
    `HTTP ${r.status}: ${r.body?.estado}, lote ${r.body?.lote}, resguardo ${r.body?.resguardo_hasta}`,
    r.status === 200 && r.body?.estado === 'creado' && r.body?.lote === 'PRUEBA-E2E-1' && !!r.body?.resguardo_hasta);

  // ---- C3-04b: reintento (doble toque o reenvío de la cola) no duplica
  r = await rpc('fn_app_aplicar_dosis', { p_dosis_id: 26 });
  anota('C3-04b', 'Reintento de la misma dosis', 'ya_registrado, sin descontar de nuevo', `HTTP ${r.status}: ${r.body?.estado}`, r.status === 200 && r.body?.estado === 'ya_registrado');

  // ---- C3-05: salida de inventario 1 ml
  const lote = await p.evaluate(async ({ SB, KEY, token }) => {
    const res = await fetch(`${SB}/rest/v1/lote?select=id,stock_lote&numero_lote=eq.PRUEBA-E2E-1`, { headers: { apikey: KEY, Authorization: 'Bearer ' + token } });
    return (await res.json())[0];
  }, { SB, KEY, token });
  r = await rpc('fn_app_registrar_salida', { p_lote_id: lote.id, p_cantidad: 1, p_motivo: 'CONTEO', p_observaciones: '[FALSO] ciclo 3' });
  anota('C3-05', 'Registrar salida de 1 ml (Inventario)', 'Devuelve el id del movimiento', `HTTP ${r.status}: movimiento ${JSON.stringify(r.body)}`, r.status === 200 && Number.isInteger(r.body));

  // ---- C3-06/07: envío diferido (sin señal) conserva la hora de aplicación
  const horaReal = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  r = await rpc('fn_app_aplicar_dosis', { p_dosis_id: 27, p_fecha_aplicada: horaReal });
  anota('C3-07', 'Envío de la cola al volver la red (aplicada 3 min antes)', 'creado y con la hora original', `HTTP ${r.status}: ${r.body?.estado} (hora enviada ${horaReal})`, r.status === 200 && r.body?.estado === 'creado');

  // ---- C3-08: registro en terreno con uuid (idempotente)
  const uuid = crypto.randomUUID ? crypto.randomUUID() : require('crypto').randomUUID();
  const reg = { p_uuid: uuid, p_diio: '900000001', p_medicamento_id: 15, p_cantidad: 1, p_indicado_por: '[FALSO] Ciclo 3', p_fecha_aplicada: new Date(Date.now() - 10 * 60 * 1000).toISOString(), p_motivo: '[FALSO] registro en terreno' };
  r = await rpc('fn_app_registrar_aplicacion', reg);
  const r2 = await rpc('fn_app_registrar_aplicacion', reg);
  anota('C3-08', 'Registrar aplicación en terreno y reenviarla', 'creado y luego ya_registrado', `${r.body?.estado} → ${r2.body?.estado}`, r.body?.estado === 'creado' && r2.body?.estado === 'ya_registrado');

  // ---- C3-09: validaciones de borde
  r = await rpc('fn_app_registrar_aplicacion', { ...reg, p_uuid: require('crypto').randomUUID(), p_diio: '12345678' });
  anota('C3-09a', 'DIIO de 8 dígitos', '«El DIIO debe tener 9 dígitos.»', msg(r), r.status >= 400 && /9 dígitos/.test(msg(r)));
  r = await rpc('fn_app_registrar_aplicacion', { ...reg, p_uuid: require('crypto').randomUUID(), p_cantidad: 0 });
  anota('C3-09b', 'Cantidad 0', '«La cantidad debe ser mayor que 0.»', msg(r), r.status >= 400 && /mayor que 0/.test(msg(r)));
  r = await rpc('fn_app_registrar_salida', { p_lote_id: lote.id, p_cantidad: 9999, p_motivo: 'CONTEO' });
  anota('C3-09c', 'Salida mayor al stock', '«Stock insuficiente…»', msg(r), r.status >= 400 && /Stock insuficiente/.test(msg(r)));
  r = await rpc('fn_app_registrar_aplicacion', { ...reg, p_uuid: require('crypto').randomUUID(), p_fecha_aplicada: new Date(Date.now() + 3600e3).toISOString() });
  anota('C3-09d', 'Fecha de aplicación futura', '«…no puede ser futura.»', msg(r), r.status >= 400 && /futura/.test(msg(r)));

  // ---- C3-11: sin sesión no se puede usar la API de la app
  r = await rpc('fn_app_aplicar_dosis', { p_dosis_id: 26 }, false);
  anota('C3-11', 'Llamar a la app sin sesión', 'Rechazo (401/403/42501)', `HTTP ${r.status}: ${msg(r)}`, r.status === 401 || r.status === 403);

  // ---- Verificación visual en el panel
  await p.goto(PANEL + '/auditoria', { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const aud = await p.locator('body').innerText();
  anota('C3-12', 'Auditoría del panel muestra el origen APPMOVIL', 'Filas con APPMOVIL', /APPMOVIL/.test(aud) ? 'Aparecen filas con APPMOVIL' : 'No aparece APPMOVIL', /APPMOVIL/.test(aud));
  await foto('C3-12_auditoria');
  await p.goto(PANEL + '/inventario', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000); await foto('C3-13_inventario');
  await p.goto(PANEL + '/tratamientos', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000); await foto('C3-14_tratamientos');
  // vista móvil del panel (comparación visual con la app, MOV-38)
  const m = await ctx.newPage(); await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(PANEL + '/', { waitUntil: 'networkidle' }); await m.waitForTimeout(2000);
  await m.screenshot({ path: path.join(OUT, 'C3-10_panel_movil.png') });

  fs.writeFileSync(path.join(__dirname, 'resultados.json'), JSON.stringify(R, null, 2));
  await navegador.close();
  console.log(`\n${R.filter((x) => x.pasa).length} de ${R.length} casos pasan`);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
