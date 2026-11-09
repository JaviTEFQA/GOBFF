/**
 * Negocio (GO-36163 · Redirecciones: salida). Para que el Nginx de plataforma redirija a la web de
 * captación al hacer logout desde una ficha, el BFF expone en UnifiedDetailedContent:
 * - `uniqueId` y `logoutUrl` en la ficha (MULTISTC-65481);
 * - `epgScheduleId` solo en LiveSchedule, es decir, en LSC (65482);
 * - `logoutUrl` como texto tal cual llega de plataforma, también vacío como fallback (65483).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { contentItems, pidKind } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

test('[MULTISTC-76676] la ficha expone uniqueId y logoutUrl, y epgScheduleId solo en LSC', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture);
  // Fichas de contenido; la de serie grabada (RSR) es un árbol de grabaciones sin estos campos.
  const details = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && i.path === '$' && !/^RSR/.test(i.obj.pid as string));
  test.skip(!details.length, 'La web no abrió ninguna ficha.');
  testInfo.annotations.push({ type: 'fichas', description: details.map((d) => d.obj.pid).join(', ') });

  // 65481: cada ficha trae uniqueId y logoutUrl (como texto).
  for (const d of details) {
    expect.soft(typeof d.obj.uniqueId, `${d.obj.pid}: uniqueId`).toBe('string');
    expect.soft(typeof d.obj.logoutUrl, `${d.obj.pid}: logoutUrl`).toBe('string');
  }

  // 65482: epgScheduleId solo en LSC, en cualquier endpoint.
  const wrong = items.filter((i) => 'epgScheduleId' in i.obj && pidKind(i.obj.pid) !== 'LSC');
  expect.soft(wrong.map((i) => `${i.endpoint} ${i.path} ${i.obj.pid}`).slice(0, 20), 'epgScheduleId fuera de LSC').toEqual([]);
  const lscNoId = items.filter((i) => pidKind(i.obj.pid) === 'LSC' && 'epgScheduleId' in i.obj && (typeof i.obj.epgScheduleId !== 'string' || i.obj.epgScheduleId === ''));
  expect.soft(lscNoId.map((i) => `${i.endpoint} ${i.obj.pid}`).slice(0, 20), 'LSC con epgScheduleId vacío').toEqual([]);

  // 65483: logoutUrl siempre texto (vacío = fallback sin alterar), nunca null ni objeto.
  const badLogout = items.filter((i) => 'logoutUrl' in i.obj && typeof i.obj.logoutUrl !== 'string');
  expect.soft(badLogout.map((i) => `${i.endpoint} ${i.obj.pid}=${JSON.stringify(i.obj.logoutUrl)}`).slice(0, 20), 'logoutUrl no es texto').toEqual([]);
});
