/**
 * Negocio (GO-35694 · Detail Page: endpoints): con un pid inexistente, `unified-detailed` responde
 * un error HTTP 4xx (no 200) con un cuerpo de error estructurado (MULTISTC-53547).
 * La journey `detail-invalid` abre `/details/movie/qa-invalid-999999999` y la captura guarda el error.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { liveErrors } from '../../../src/testing/live-capture';

test('[MULTISTC-76679] pid inexistente → 4xx con error estructurado', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, errors } = liveErrors('GET nsh/unified-detailed/{pid}');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const invalid = errors.filter((e) => /999999999/.test(e.url));
  test.skip(!invalid.length, 'La journey detail-invalid no provocó la llamada (¿cambió la ruta de fichas de la web?).');

  for (const e of invalid) {
    testInfo.annotations.push({ type: 'respuesta', description: `${e.status} ${JSON.stringify(e.body).slice(0, 200)}` });
    expect(e.status, 'debe ser un 4xx (no encontrado / validación)').toBeGreaterThanOrEqual(400);
    expect(e.status).toBeLessThan(500);
    const body = e.body as { errors?: { message?: unknown; code?: unknown }[] } | null;
    expect.soft(Array.isArray(body?.errors) && body!.errors!.length > 0, 'cuerpo con lista errors[]').toBe(true);
    const first = body?.errors?.[0];
    expect.soft(typeof first?.message === 'string' && first.message !== '', 'error con message').toBe(true);
    expect.soft(first?.code !== undefined, 'error con code').toBe(true);
  }
});
