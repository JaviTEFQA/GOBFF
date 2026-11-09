/**
 * Negocio (GO-36266 · Watermarking): "BFF propagará el param wmk directamente de APIHub" en el
 * objeto LCH; la app solo superpone la marca de agua de Nagra en los canales con wmk=true.
 * Automatiza MULTISTC-65250. Además, el playback trae `wmkEnabled` booleano.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { channelObjects, contentItems, inconsistentAcrossEndpoints, nonBoolean, tally } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

test('[MULTISTC-76672] todo canal (LCH) trae wmk booleano y el mismo valor en todas las pantallas', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const channels = channelObjects(contentItems(capture));
  test.skip(!channels.length, 'La captura no trae canales (LCH).');
  testInfo.annotations.push({ type: 'wmk', description: tally(channels, 'wmk') });

  // Objetos LCH "completos" (con título): todos deben traer wmk.
  const full = channels.filter((c) => typeof c.obj.title === 'string');
  const missing = full.filter((c) => !('wmk' in c.obj));
  expect.soft(missing.map((c) => `${c.endpoint} ${c.path} ${c.obj.pid}`).slice(0, 20), 'canales sin wmk').toEqual([]);
  expect.soft(nonBoolean(channels, 'wmk'), 'wmk no booleano').toEqual([]);
  expect.soft(inconsistentAcrossEndpoints(channels, 'wmk'), 'wmk distinto según el endpoint').toEqual([]);

  const playback = capture!.endpoints['GET playback/information'] ?? [];
  for (const s of playback) {
    const v = (s.body as Record<string, unknown>)?.wmkEnabled;
    if (v !== undefined) expect.soft(typeof v, 'playback wmkEnabled no booleano').toBe('boolean');
  }
});
