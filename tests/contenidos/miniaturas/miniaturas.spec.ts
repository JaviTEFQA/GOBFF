/**
 * Negocio (GO-35216 · Migración de Thumbnails VoD, GO-35292 · Control de hasThumbnails):
 * "BFF propagará en todos los contenidos el param hasThumbnails" (GOSPECS-4509). Las apps solo
 * piden miniaturas si hasThumbnails=true, así que un valor no booleano o incoherente rompe el scrubbing.
 * Automatiza MULTISTC-52070.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at, contentItems, inconsistentAcrossEndpoints, nonBoolean, pidKind, tally } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

// Contenidos reproducibles: los que pueden tener miniaturas (VoD, directo, grabación, canal).
const PLAYABLE = new Set(['MOV', 'EPI', 'LSC', 'REC', 'LCH']);

test('[MULTISTC-76671] hasThumbnails presente, booleano y coherente en los contenidos', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture);
  const flagged = items.filter((i) => 'hasThumbnails' in i.obj);
  test.skip(!flagged.length, 'Ningún contenido capturado trae hasThumbnails.');
  testInfo.annotations.push({ type: 'hasThumbnails', description: tally(items, 'hasThumbnails') });

  expect.soft(nonBoolean(items, 'hasThumbnails'), 'hasThumbnails no booleano').toEqual([]);

  // Fichas (raíz de unified-detailed) de contenido reproducible: deben traerlo.
  const details = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && i.path === '$' && PLAYABLE.has(pidKind(i.obj.pid)));
  for (const d of details) expect.soft(typeof d.obj.hasThumbnails, `ficha ${d.obj.pid} sin hasThumbnails`).toBe('boolean');

  // LSC: sus miniaturas son las del canal, así que el flag del LSC es el de su liveChannel.
  const lscMismatch = items.filter(
    (i) => pidKind(i.obj.pid) === 'LSC' && typeof i.obj.hasThumbnails === 'boolean' && typeof at(i.obj, 'liveChannel.hasThumbnails') === 'boolean' && i.obj.hasThumbnails !== at(i.obj, 'liveChannel.hasThumbnails'),
  );
  expect.soft(lscMismatch.map((i) => `${i.endpoint} ${i.obj.pid}`), 'LSC con hasThumbnails distinto del de su canal').toEqual([]);

  expect.soft(inconsistentAcrossEndpoints(items, 'hasThumbnails'), 'hasThumbnails distinto según el endpoint').toEqual([]);
});
