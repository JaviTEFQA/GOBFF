/**
 * Negocio (GO-36384 · TV Unique ID Events: catchup como LSC). Un LSC ya emitido cuya
 * `availableUntilPolaris` sigue en el futuro es un catchup y se presenta como tal:
 * - catchup → `buttons.isPlayVisible`, `bars.isCatalogExpirationVisible` e `isFFRWBlockedInLxD` (MULTISTC-68673, 68675),
 *   sin tráiler (68677);
 * - caducado sin ser catchup (availableUntil = availableUntilPolaris, ya pasada) → ni play, ni barra, ni LxD (68674);
 * - en emisión o futuro → sin `isFFRWBlockedInLxD` (69605, paso 3).
 * "Ahora" es el momento en que llegó cada respuesta; se deja un margen para no caer en la frontera.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at, contentItems, pidKind, type ContentItem } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

const MARGIN_S = 180;
type Kind = 'catchup' | 'caducado' | 'en-emision' | 'futuro' | 'frontera';

function classify(i: ContentItem): Kind {
  const e = i.obj.emissionDate as { start: number; end: number };
  const au = i.obj.availableUntil as number;
  const ap = i.obj.availableUntilPolaris as number;
  const now = i.nowS;
  if (e.start > now + MARGIN_S) return 'futuro';
  if (e.start < now - MARGIN_S && e.end > now + MARGIN_S) return 'en-emision';
  if (e.end < now - MARGIN_S && ap > now + MARGIN_S && au !== ap) return 'catchup';
  if (e.end < now - MARGIN_S && au === ap && ap < now - MARGIN_S) return 'caducado';
  return 'frontera';
}

const flagged = (v: unknown) => v === true;

test('[MULTISTC-76675] el LSC emitido dentro de su disponibilidad se presenta como catchup', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const lsc = contentItems(capture).filter(
    (i) => pidKind(i.obj.pid) === 'LSC' && i.obj.emissionDate && typeof i.obj.availableUntil === 'number' && typeof i.obj.availableUntilPolaris === 'number',
  );
  test.skip(!lsc.length, 'La captura no trae LSC con fechas.');

  const groups = new Map<Kind, ContentItem[]>();
  for (const i of lsc) groups.set(classify(i), [...(groups.get(classify(i)) ?? []), i]);
  testInfo.annotations.push({ type: 'LSC', description: [...groups.entries()].map(([k, v]) => `${k}: ${v.length}`).join(', ') });

  const label = (i: ContentItem) => `${i.endpoint} ${i.obj.pid}`;
  // Solo se miran botones/barras donde el endpoint los envía (la parrilla `channels` no trae buttons).
  const withButtons = (l: ContentItem[]) => l.filter((i) => i.obj.buttons && typeof i.obj.buttons === 'object');
  const withBars = (l: ContentItem[]) => l.filter((i) => i.obj.bars && typeof i.obj.bars === 'object');

  const catchup = groups.get('catchup') ?? [];
  expect.soft(withButtons(catchup).filter((i) => !flagged(at(i.obj, 'buttons.isPlayVisible'))).map(label), '68673: catchup sin isPlayVisible').toEqual([]);
  expect.soft(withBars(catchup).filter((i) => !flagged(at(i.obj, 'bars.isCatalogExpirationVisible'))).map(label), '68675: catchup sin barra de caducidad').toEqual([]);
  expect.soft(catchup.filter((i) => typeof i.obj.isFFRWBlockedInLxD !== 'boolean').map(label), '68673: catchup sin isFFRWBlockedInLxD').toEqual([]);
  expect.soft(catchup.filter((i) => Array.isArray(i.obj.trailers) && i.obj.trailers.length > 0).map(label), '68677: catchup con tráiler').toEqual([]);

  const expired = groups.get('caducado') ?? [];
  expect.soft(withButtons(expired).filter((i) => flagged(at(i.obj, 'buttons.isPlayVisible'))).map(label), '68674: caducado con isPlayVisible').toEqual([]);
  expect.soft(withBars(expired).filter((i) => flagged(at(i.obj, 'bars.isCatalogExpirationVisible'))).map(label), '68674: caducado con barra de caducidad').toEqual([]);
  expect.soft(expired.filter((i) => 'isFFRWBlockedInLxD' in i.obj).map(label), '68674: caducado con isFFRWBlockedInLxD').toEqual([]);

  const notPast = [...(groups.get('en-emision') ?? []), ...(groups.get('futuro') ?? [])];
  expect.soft(notPast.filter((i) => 'isFFRWBlockedInLxD' in i.obj).map(label).slice(0, 20), '69605: LSC en emisión o futuro con isFFRWBlockedInLxD').toEqual([]);

  if (!catchup.length) testInfo.annotations.push({ type: 'aviso', description: 'Ningún LSC catchup en esta captura: las reglas de catchup no se han podido comprobar.' });
});
