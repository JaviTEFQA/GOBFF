/**
 * Negocio (GO-33189): el carrusel "Top" de la home no supera los 10 contenidos.
 * Busca en nsh/thematic-site-page-prio las secciones cuyo título sea un "Top …" y comprueba que
 * traen 10 o menos elementos (y al menos uno). Valida la respuesta real capturada en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Section {
  title?: unknown;
  contents?: unknown;
}

test('[MULTISTC-76649] el carrusel Top no supera los 10 contenidos', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/thematic-site-page-prio');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no llamó a nsh/thematic-site-page-prio durante el recorrido.');

  const body = samples[0]!.body as { thematicSite?: unknown };
  const sections = (Array.isArray(body?.thematicSite) ? body!.thematicSite : []) as Section[];
  const tops = sections.filter((s) => typeof s.title === 'string' && /\btop\b/i.test(s.title));
  test.skip(!tops.length, 'La home capturada no trae ningún carrusel "Top …".');

  testInfo.annotations.push({ type: 'top-carousels', description: tops.map((s) => `${s.title}: ${Array.isArray(s.contents) ? s.contents.length : '-'}`).join(' | ') });

  for (const s of tops) {
    const n = Array.isArray(s.contents) ? s.contents.length : 0;
    expect.soft(n, `"${s.title}" trae ${n} contenidos (debe ser 1..10)`).toBeGreaterThan(0);
    expect.soft(n, `"${s.title}" trae ${n} contenidos (máximo 10)`).toBeLessThanOrEqual(10);
  }
});
