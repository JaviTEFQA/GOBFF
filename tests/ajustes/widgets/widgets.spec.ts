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

  // GO-36521: widget dinámico type 63, en cualquier nivel del árbol de ajustes.
  const all: Record<string, unknown>[] = [];
  const walk = (list: unknown) => {
    for (const w of (Array.isArray(list) ? list : []) as Record<string, unknown>[]) {
      all.push(w);
      walk(w.childSettings);
    }
  };
  walk(body.childSettings);
  const dynamic = all.filter((w) => w.type === 63);
  testInfo.annotations.push({ type: 'widgets type 63', description: dynamic.length ? dynamic.map((w) => String(w.pid)).join(', ') : 'ninguno en esta cuenta: reglas 60069–60071 sin datos' });
  for (const w of dynamic) {
    const id = `widget 63 (${String(w.pid)})`;
    expect.soft(typeof w.title === 'string' && w.title.trim() !== '', `${id} sin título`).toBe(true);
    // MULTISTC-60069: se propagan los campos del widget dinámico (la url de destino, al menos).
    expect.soft(typeof w.url === 'string' && w.url !== '', `${id} sin url`).toBe(true);
    // MULTISTC-60070: newTab y sso nunca null (false por defecto).
    expect.soft(typeof w.newTab, `${id}: newTab`).toBe('boolean');
    expect.soft(typeof w.sso, `${id}: sso`).toBe('boolean');
    // MULTISTC-60071: la web no recibe los campos de la modal de pantalla grande.
    expect.soft(['modalTitle', 'modalDescription', 'modalLabel', 'modalQr'].filter((k) => k in w), `${id}: campos modal* en Web`).toEqual([]);
  }
});
