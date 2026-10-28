// Prueba de estrés: sube a 100, 200 y 400 usuarios simultáneos (45 s cada etapa) para ver dónde
// empieza a degradarse el servicio. Cada usuario hace una vuelta por segundo: el panel y una ruta del Worker.
// ponytail: ~31.000 llamadas al Worker, bajo el límite diario del plan gratuito de Cloudflare (100.000).
import http from 'k6/http';
import { check, sleep } from 'k6';

const PANEL = 'https://moncopulli-panel.itskay666.workers.dev';
const BOT = 'https://moncopullis-bot.itskay666.workers.dev';
const ETAPAS = [100, 200, 400];
const DURACION = 45;

export const options = {
  scenarios: Object.fromEntries(ETAPAS.map((vus, i) => [`u${vus}`, {
    executor: 'constant-vus', vus, duration: `${DURACION}s`, startTime: `${i * (DURACION + 5)}s`,
    gracefulStop: '5s', tags: { etapa: String(vus) },
  }])),
  // Umbrales por etapa: así el resumen trae p95 y tasa de éxito de cada una
  thresholds: Object.fromEntries(ETAPAS.flatMap((v) => [
    [`http_req_duration{etapa:${v}}`, ['p(95)<500']],
    [`checks{etapa:${v}}`, ['rate>0.99']],
  ])),
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const json = { headers: { 'Content-Type': 'application/json' } };

export default function () {
  check(http.get(`${PANEL}/`), { 'panel 200': (r) => r.status === 200 });
  check(http.post(`${BOT}/importar`, '{}', json), { 'importar sin token 401': (r) => r.status === 401 });
  sleep(1);
}
