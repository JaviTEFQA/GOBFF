/**
 * Negocio (GO-36935 · Filtrado de contenidos infantiles): "BFF propagará el param isKids en todos
 * los objetos LCH que puedan aparecer en carruseles, grids, búsquedas" (GOSPECS-4968).
 * Automatiza MULTISTC-64665. Si el perfil activo es infantil, la parrilla solo puede traer canales
 * isKids=true (la web pide `channels?is_kids=true`).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { channelObjects, contentItems, inconsistentAcrossEndpoints, nonBoolean, tally } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

test('[MULTISTC-76673] todo canal (LCH) trae isKids booleano y el perfil infantil solo ve canales infantiles', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const channels = channelObjects(contentItems(capture));
  test.skip(!channels.length, 'La captura no trae canales (LCH).');
  testInfo.annotations.push({ type: 'isKids', description: tally(channels, 'isKids') });

  const full = channels.filter((c) => typeof c.obj.title === 'string');
  const missing = full.filter((c) => !('isKids' in c.obj));
  expect.soft(missing.map((c) => `${c.endpoint} ${c.path} ${c.obj.pid}`).slice(0, 20), 'canales sin isKids').toEqual([]);
  expect.soft(nonBoolean(channels, 'isKids'), 'isKids no booleano').toEqual([]);
  expect.soft(inconsistentAcrossEndpoints(channels, 'isKids'), 'isKids distinto según el endpoint').toEqual([]);

  // Perfil infantil: la parrilla de canales (pedida con is_kids=true) no puede traer canales adultos.
  const grids = (capture!.endpoints['GET channels'] ?? []).filter((s) => /[?&]is_kids=true/i.test(s.url));
  testInfo.annotations.push({ type: 'perfil', description: grids.length ? 'infantil (is_kids=true)' : 'no infantil: la regla de filtrado no aplica en esta captura' });
  for (const g of grids) {
    const adult = channelObjects(contentItems({ ...capture!, endpoints: { 'GET channels': [g] } })).filter((c) => c.obj.isKids === false);
    expect.soft(adult.map((c) => c.obj.pid), 'canales no infantiles en la parrilla del perfil infantil').toEqual([]);
  }
});
