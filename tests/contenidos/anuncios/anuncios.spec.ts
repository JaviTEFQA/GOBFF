/**
 * Negocio (GO-35350, GO-35725, GO-35955, GO-35973 · Advertisement): el BFF propaga `hasAds` en
 * películas, episodios y grabaciones, y `hasAds` + `hasPrerollAds` en los LSC (directo / LxD).
 * Automatiza MULTISTC-54044 (MOV/EPI), 54642 (REC), 65318 (LSC) y 54584 (LSC pasado y MOV LxD).
 * En Alemania el caso de zapping (GO-35955) no inserta publicidad: aquí solo se valida la propagación.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { contentItems, inconsistentAcrossEndpoints, nonBoolean, pidKind, tally } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

test('[MULTISTC-76670] hasAds y hasPrerollAds se propagan como booleanos y coherentes', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture);
  // 65318 pide hasAds en el detalle/ficha del LSC: las tarjetas de "Similares" (relatedContents) son
  // ítems ligeros y no lo traen.
  const lsc = items.filter((i) => pidKind(i.obj.pid) === 'LSC' && 'emissionDate' in i.obj && !/\.relatedContents\./.test(i.path));
  test.skip(!lsc.length, 'La captura no trae LSC.');

  testInfo.annotations.push(
    { type: 'hasAds', description: tally(items, 'hasAds') },
    { type: 'hasPrerollAds', description: tally(items, 'hasPrerollAds') },
  );

  // 65318: todo LSC trae hasAds y hasPrerollAds.
  const lscMissing = lsc.filter((i) => !('hasAds' in i.obj) || !('hasPrerollAds' in i.obj));
  expect.soft(lscMissing.map((i) => `${i.endpoint} ${i.obj.pid}`), 'LSC sin hasAds/hasPrerollAds').toEqual([]);

  // 54044 / 54642 / 54584: allí donde aparece, booleano (MOV, EPI, REC, LSC).
  for (const f of ['hasAds', 'hasPrerollAds']) expect.soft(nonBoolean(items, f), `${f} no booleano`).toEqual([]);

  // 54044: la ficha de una película trae hasAds en la raíz.
  const movDetail = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && i.path === '$' && pidKind(i.obj.pid) === 'MOV');
  for (const d of movDetail) expect.soft(typeof d.obj.hasAds, `ficha ${d.obj.pid} sin hasAds`).toBe('boolean');

  // El mismo contenido no puede cambiar de valor según la pantalla.
  for (const f of ['hasAds', 'hasPrerollAds']) expect.soft(inconsistentAcrossEndpoints(items, f), `${f} distinto según el endpoint`).toEqual([]);
});
