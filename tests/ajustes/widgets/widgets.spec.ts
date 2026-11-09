/**
 * Negocio (GO-36521): GET nsh/settings devuelve una configuración de widgets bien formada.
 * Cada widget (childSettings) debe traer un `type` numérico y `pid`, y la raíz su `pid`/`title`.
 * Si aparece el widget dinámico type 63 (la historia), se valida además que está bien formado.
 * Valida la respuesta real capturada en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Widget {
  type?: unknown;
  pid?: unknown;
  title?: unknown;
  contentType?: unknown;
}

test('[MULTISTC-76655] la configuración de settings trae widgets bien formados', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/settings');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no llamó a nsh/settings durante el recorrido.');

  const body = samples[0]!.body as { pid?: unknown; title?: unknown; childSettings?: unknown };
  expect(typeof body?.pid === 'string' && body.pid.trim() !== '', 'settings sin pid').toBe(true);
  expect(typeof body?.title === 'string', 'settings sin title').toBe(true);
  expect(Array.isArray(body?.childSettings), 'childSettings no es lista').toBe(true);

  const widgets = body!.childSettings as Widget[];
  expect(widgets.length, 'settings sin widgets').toBeGreaterThan(0);

  testInfo.annotations.push({ type: 'widget-types', description: [...new Set(widgets.map((w) => String(w.type)))].join(', ') });

  // Todo widget necesita type numérico y pid para que el cliente sepa qué pintar y a dónde navegar.
  const malformed = widgets.filter((w) => typeof w.type !== 'number' || typeof w.pid !== 'string' || w.pid.trim() === '');
  expect.soft(malformed.map((w) => JSON.stringify(w).slice(0, 100)), 'widgets sin type numérico o sin pid').toEqual([]);

  // GO-36521: si aparece el widget dinámico type 63, debe traer title no vacío.
  const dynamic = widgets.filter((w) => w.type === 63);
  for (const w of dynamic) {
    expect.soft(typeof w.title === 'string' && w.title.trim() !== '', `widget 63 (${String(w.pid)}) sin título`).toBe(true);
  }
});
