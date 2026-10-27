// Prueba de carga (R1): 50 usuarios durante 60 s sobre el panel y las rutas públicas del Worker.
// Umbrales del plan: p95 < 500 ms y menos de 1 % de respuestas inesperadas.
import http from 'k6/http';
import { check } from 'k6';

const PANEL = 'https://moncopulli-panel.itskay666.workers.dev';
const BOT = 'https://moncopullis-bot.itskay666.workers.dev';

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    checks: ['rate>0.99'],
  },
};

const json = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  check(http.get(`${PANEL}/`), { 'panel 200': (r) => r.status === 200 });
  check(http.post(`${BOT}/telegram/webhook`, '{}', json), { 'webhook sin secreto 403': (r) => r.status === 403 });
  check(http.post(`${BOT}/importar`, '{}', json), { 'importar sin token 401': (r) => r.status === 401 });
}
