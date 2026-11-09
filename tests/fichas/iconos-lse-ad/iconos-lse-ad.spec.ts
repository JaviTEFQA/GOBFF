/**
 * Negocio (GO-36549 · Content info: iconos LSE y AD). En los ítems de `thematic-site-page` y
 * `thematic-site-page-prio` y en la ficha, `is5s` (lengua de signos) e `isAudioDescription` son
 * booleanos o están ausentes, independientes entre sí, y un mismo contenido lleva el mismo valor en
 * todas las pantallas (MULTISTC-64207, 64208, 64209, 64210, 53626, 53627).
 * Nota: el campo real es `is5s` (los TCs lo escriben `is5S`).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { contentItems, inconsistentAcrossEndpoints, nonBoolean, tally } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

const ENDPOINTS = ['GET nsh/thematic-site-page/{pid}', 'GET nsh/thematic-site-page-prio', 'POST nsh/carousel', 'GET nsh/unified-detailed/{pid}'];

test('[MULTISTC-76681] is5s e isAudioDescription son booleanos y coherentes entre pantallas', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture, ENDPOINTS);
  test.skip(!items.length, 'La captura no trae áreas temáticas ni fichas.');
  testInfo.annotations.push({ type: 'is5s', description: tally(items, 'is5s') }, { type: 'isAudioDescription', description: tally(items, 'isAudioDescription') });

  for (const f of ['is5s', 'isAudioDescription']) {
    expect.soft(nonBoolean(items, f), `${f} no booleano`).toEqual([]);
    expect.soft(inconsistentAcrossEndpoints(items, f), `${f} distinto según el endpoint`).toEqual([]);
  }
  // 64210: ambos a true en el mismo objeto no deben pisarse (siguen siendo booleanos independientes).
  const both = items.filter((i) => i.obj.is5s === true && i.obj.isAudioDescription === true);
  testInfo.annotations.push({ type: 'ambos a true', description: String(both.length) });
  // La ficha (53626/53627) de MOV/SER los trae en la raíz.
  const details = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && i.path === '$' && /^(MOV|SER)/.test(i.obj.pid as string));
  for (const d of details) {
    expect.soft(typeof d.obj.is5s, `ficha ${d.obj.pid}: is5s`).toBe('boolean');
    expect.soft(typeof d.obj.isAudioDescription, `ficha ${d.obj.pid}: isAudioDescription`).toBe('boolean');
  }
  if (!items.some((i) => i.obj.is5s === true || i.obj.isAudioDescription === true)) {
    testInfo.annotations.push({ type: 'aviso', description: 'Ningún contenido con LSE o AD en esta captura: solo se valida el formato y la coherencia.' });
  }
});
