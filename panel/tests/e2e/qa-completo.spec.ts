import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIR_EVIDENCIAS = path.resolve(__dirname, '../../../qa-evidencias');

// Simula respuestas de Supabase Auth y REST para probar sin claves reales
async function mockSupabaseAutenticado(page: import('@playwright/test').Page) {
  await page.route('**/auth/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token: 'mock-token-qa',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin.qa@moncopulli.cl',
          role: 'authenticated',
          app_metadata: { rol: 'ADMIN' },
        },
      }),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Auditoría QA Integral - Panel Web Moncopulli', () => {
  test.beforeAll(() => {
    if (!fs.existsSync(DIR_EVIDENCIAS)) {
      fs.mkdirSync(DIR_EVIDENCIAS, { recursive: true });
    }
  });

  test('CP-01 [Seguridad - Acceso]: Bloquea o pide login si no hay sesión activa', async ({ page }) => {
    await page.route('**/auth/v1/**', async (route) => {
      await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Unauthorized' }) });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Verifica que exista un formulario de acceso (inputs de correo/contraseña) o bloqueo de vista
    const inputsLogin = await page.locator('input').count();
    expect(inputsLogin).toBeGreaterThan(0);
  });

  test('CP-02 [Caso de Uso - Nominal]: Carga del panel principal con sesión ADMIN simulada', async ({ page }) => {
    await mockSupabaseAutenticado(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveTitle('');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: path.join(DIR_EVIDENCIAS, 'e2e-01-inicio.png'), fullPage: true });
  });

  test('CP-03 [Caso de Uso y Borde]: Navegación por rutas y validación de campos vacíos en formularios', async ({ page }) => {
    await mockSupabaseAutenticado(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Recorre los enlaces o botones de navegación disponibles en el menú
    const enlaces = page.locator('nav a, aside a, nav button');
    const totalEnlaces = await enlaces.count();

    for (let i = 0; i < totalEnlaces; i++) {
      const item = enlaces.nth(i);
      if (await item.isVisible()) {
        await item.click();
        await page.waitForTimeout(300);

        // Si la vista tiene un botón de envío (submit), prueba enviarlo vacío (caso de borde)
        const btnSubmit = page.locator('button[type="submit"]').first();
        if (await btnSubmit.isVisible()) {
          await btnSubmit.click();
          // La aplicación no debe colapsar ni quedar en blanco ante un envío vacío
          await expect(page.locator('body')).not.toBeEmpty();
        }
      }
    }
  });

  test('CP-04 [Seguridad - XSS]: Neutralización de scripts maliciosos en entradas de texto', async ({ page }) => {
    await mockSupabaseAutenticado(page);
    let alertaEjecutada = false;
    page.on('dialog', () => {
      alertaEjecutada = true;
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const inputsTexto = page.locator('input[type="text"], input:not([type]), textarea');
    const cantidad = await inputsTexto.count();

    for (let i = 0; i < cantidad; i++) {
      const campo = inputsTexto.nth(i);
      if (await campo.isVisible() && await campo.isEditable()) {
        await campo.fill('<script>alert("XSS-QA")</script>');
      }
    }

    expect(alertaEjecutada).toBe(false);
  });

  test('CP-05 [Seguridad - Cabeceras HTTP]: Inspección de cabeceras de respuesta del servidor', async ({ request }) => {
    const response = await request.get('/');
    const headers = response.headers();

    const reporteHeaders = {
      status: response.status(),
      'x-content-type-options': headers['x-content-type-options'] ?? 'AUSENTE',
      'x-frame-options': headers['x-frame-options'] ?? 'AUSENTE',
      'content-security-policy': headers['content-security-policy'] ?? 'AUSENTE',
      'strict-transport-security': headers['strict-transport-security'] ?? 'AUSENTE',
    };

    fs.writeFileSync(
      path.join(DIR_EVIDENCIAS, 'e2e-02-cabeceras-seguridad.json'),
      JSON.stringify(reporteHeaders, null, 2),
      'utf-8'
    );

    expect(response.status()).toBeLessThan(500);
  });

  test('CP-06 [Accesibilidad WCAG 2.1]: Auditoría automática con axe-core', async ({ page }) => {
    await mockSupabaseAutenticado(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const resultados = await new AxeBuilder({ page }).analyze();

    fs.writeFileSync(
      path.join(DIR_EVIDENCIAS, 'e2e-03-accesibilidad-axe.json'),
      JSON.stringify(
        {
          totalViolaciones: resultados.violations.length,
          violaciones: resultados.violations.map((v) => ({
            id: v.id,
            impacto: v.impact,
            descripcion: v.help,
            elementosAfectados: v.nodes.length,
          })),
        },
        null,
        2
      ),
      'utf-8'
    );

    expect(resultados.violations).toEqual([]);
  });
});