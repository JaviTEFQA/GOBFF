/**
 * Negocio (GO-36315 · Rent & Subscription flows: suscripciones en la ficha de contenido).
 * - `subscriptions` lista solo paquetes comprables: pid SUB…, title, pricings recurrentes (isRecurring=true)
 *   y logo de tipo Icon (MULTISTC-68325).
 * - Sin paquetes comprables, no se ofrece suscribirse: buttons.isSubscribeVisible=false (68326).
 * - bars.isActivatedPendingVisible nunca con canWatch=true (68327).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at, contentItems } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

interface Sub {
  pid?: unknown;
  title?: unknown;
  pricings?: { isRecurring?: unknown }[];
  logo?: { type?: unknown; url?: unknown; image?: { type?: unknown; url?: unknown } };
}

test('[MULTISTC-76684] la ficha ofrece solo paquetes comprables y bien formados', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  // Regla de la ficha y su episodio relevante (en carruseles y relacionados el paquete viene resumido, sin pricings).
  const items = contentItems(capture, ['GET nsh/unified-detailed/{pid}']).filter((i) => (i.path === '$' || i.path === '$.relevantEpisode') && Array.isArray(i.obj.subscriptions) && /^(MOV|EPI|SER|LSC|LSR)/.test(i.obj.pid as string));
  test.skip(!items.length, 'Ninguna ficha capturada trae subscriptions (journey detail-subscribable).');
  const offering = items.filter((i) => (i.obj.subscriptions as unknown[]).length > 0);
  testInfo.annotations.push({ type: 'contenidos', description: `${items.length} con subscriptions, ${offering.length} con algún paquete` });

  const badSubs = offering.flatMap((i) =>
    (i.obj.subscriptions as Sub[])
      .filter((s) => {
        const logoType = s.logo?.type ?? s.logo?.image?.type;
        return typeof s.pid !== 'string' || !/^SUB/.test(s.pid) || typeof s.title !== 'string' || !Array.isArray(s.pricings) || s.pricings.some((p) => p.isRecurring !== true) || (logoType !== undefined && logoType !== 'Icon');
      })
      .map((s) => `${i.obj.pid} → ${JSON.stringify(s).slice(0, 120)}`),
  );
  expect.soft([...new Set(badSubs)].slice(0, 15), '68325: paquetes sin pid/title/pricings recurrentes o con logo que no es Icon').toEqual([]);

  const noOffer = items.filter((i) => (i.obj.subscriptions as unknown[]).length === 0 && at(i.obj, 'buttons.isSubscribeVisible') === true);
  expect.soft(noOffer.map((i) => `${i.endpoint} ${i.obj.pid}`).slice(0, 15), '68326: botón suscribirse sin paquetes comprables').toEqual([]);

  const pendingButWatch = items.filter((i) => at(i.obj, 'rights.canWatch') === true && at(i.obj, 'bars.isActivatedPendingVisible') === true);
  expect.soft(pendingButWatch.map((i) => `${i.endpoint} ${i.obj.pid}`).slice(0, 15), '68327: pendiente de activación con canWatch').toEqual([]);
});
