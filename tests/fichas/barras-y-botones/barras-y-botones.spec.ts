/**
 * Negocio (GO-35633 / GO-35694 · Detail Page: endpoints y metadata). Reglas que el BFF calcula en
 * `bars` a partir de `rights.canWatch`, `pricings`, `subscriptions` y `deviceTypes`, en la ficha y en
 * cualquier contenido que las traiga (episodio relevante, carruseles):
 * - bars.isPurchaseVisible  = pricings > 0 y no canWatch (MULTISTC-61946, 53540)
 * - bars.isSubscribeVisible = subscriptions > 0, no canWatch y no isActivatedPendingVisible (61945, 53541)
 * - canWatch → nunca isActivatedPendingVisible (61944)
 * - Web (deviceType 401): isNotAvailableInThisDevice = deviceTypes no incluye 401 (61947)
 * Y la metadata: tráileres del propio contenido (61949), emisiones futuras del episodio relevante
 * (68837, 68838), relevantEpisode en la raíz de SER/LSR (53539), renderChild booleano (53542),
 * commercialization con isTvod/isSubscribable (53545) e isComingSoon booleano (53628).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at, contentItems, nonBoolean, type ContentItem } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

const WEB_DEVICE_TYPE = 401;
const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);
const label = (i: ContentItem) => `${i.endpoint} ${i.path} ${i.obj.pid}`;

test('[MULTISTC-76678] la ficha calcula bars y propaga la metadata según las reglas de la historia', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture);
  const withBars = items.filter((i) => i.obj.bars && typeof i.obj.bars === 'object' && typeof at(i.obj, 'rights.canWatch') === 'boolean');
  test.skip(!withBars.length, 'La captura no trae contenidos con bars y rights.');
  testInfo.annotations.push({ type: 'contenidos con bars', description: String(withBars.length) });

  const bad = (rule: string, list: ContentItem[]) => expect.soft(list.map(label).slice(0, 15), rule).toEqual([]);
  bad('61946: isPurchaseVisible ≠ (pricings > 0 y no canWatch)', withBars.filter((i) => 'isPurchaseVisible' in (i.obj.bars as object) && at(i.obj, 'bars.isPurchaseVisible') !== (len(i.obj.pricings) > 0 && at(i.obj, 'rights.canWatch') === false)));
  bad(
    '61945: isSubscribeVisible ≠ (subscriptions > 0, no canWatch, no pendiente)',
    withBars.filter(
      (i) =>
        'isSubscribeVisible' in (i.obj.bars as object) &&
        'subscriptions' in i.obj &&
        at(i.obj, 'bars.isSubscribeVisible') !== (len(i.obj.subscriptions) > 0 && at(i.obj, 'rights.canWatch') === false && at(i.obj, 'bars.isActivatedPendingVisible') !== true),
    ),
  );
  bad('61944: canWatch con isActivatedPendingVisible', withBars.filter((i) => at(i.obj, 'rights.canWatch') === true && at(i.obj, 'bars.isActivatedPendingVisible') === true));
  bad(
    '61947: isNotAvailableInThisDevice ≠ (deviceTypes sin 401)',
    withBars.filter((i) => Array.isArray(i.obj.deviceTypes) && 'isNotAvailableInThisDevice' in (i.obj.bars as object) && at(i.obj, 'bars.isNotAvailableInThisDevice') !== !(i.obj.deviceTypes as unknown[]).includes(WEB_DEVICE_TYPE)),
  );

  // 61949: cada tráiler es un media del propio contenido.
  // (en carruseles el tráiler viene resumido como url: la regla es de la ficha)
  const trailerOwners = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && Array.isArray(i.obj.trailers) && (i.obj.trailers as unknown[]).length > 0);
  const badTrailers = trailerOwners.flatMap((i) =>
    (i.obj.trailers as Record<string, unknown>[]).filter((t) => typeof t.pid !== 'string' || t.parentPid !== i.obj.pid || typeof t.quality !== 'number').map((t) => `${i.obj.pid} → ${JSON.stringify(t).slice(0, 80)}`),
  );
  expect.soft(badTrailers.slice(0, 15), '61949: tráileres sin pid/quality o de otro contenido').toEqual([]);

  // 68837 / 68838: emisiones futuras del episodio relevante.
  // Fichas de contenido (las de serie grabada, RSR, son un árbol de grabaciones: ver grabaciones/ficha-serie).
  const details = items.filter((i) => i.endpoint === 'GET nsh/unified-detailed/{pid}' && i.path === '$' && !/^RSR/.test(i.obj.pid as string));
  for (const d of details) {
    const re = d.obj.relevantEpisode as Record<string, unknown> | undefined;
    const future = at(re, 'emissions.future') as { start: number; end: number }[] | undefined;
    if (!Array.isArray(future)) continue;
    const own = re?.emissionDate as { start: number } | undefined;
    expect.soft(future.filter((e) => !(e.start > d.nowS - 60)).length, `${d.obj.pid}: emisiones pasadas en emissions.future (68837)`).toBe(0);
    if (own) expect.soft(future.some((e) => e.start === own.start), `${d.obj.pid}: emissions.future repite la emisión propia (68838)`).toBe(false);
  }

  // 53539: serie y serie en directo traen el episodio relevante en la raíz.
  for (const d of details.filter((x) => /^(SER|LSR)/.test(x.obj.pid as string))) expect.soft(typeof d.obj.relevantEpisode, `${d.obj.pid}: relevantEpisode en la raíz`).toBe('object');

  // 53542 / 53545 / 53628: formatos.
  expect.soft(nonBoolean(items, 'renderChild'), '53542: renderChild no booleano').toEqual([]);
  expect.soft(nonBoolean(items, 'isComingSoon'), '53628: isComingSoon no booleano').toEqual([]);
  const badComm = details.filter((d) => typeof at(d.obj, 'commercialization.isTvod') !== 'boolean' || typeof at(d.obj, 'commercialization.isSubscribable') !== 'boolean');
  bad('53545: commercialization sin isTvod/isSubscribable booleanos', badComm);
});
