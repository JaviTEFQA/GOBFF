/**
 * Negocio (GO-36781 · Rent & Subscription flows: refactor de Ajustes > TV-Pakete).
 * - `subscriptions/purchased`: lista (vacía si no hay, sin error) con pid SUB…, title, logo y shortDescription (MULTISTC-65309, 65310, 65311).
 * - `subscriptions/available`: lista (vacía si no hay, sin error) con pid, title, logo y pricings (65313, 65314, 65315).
 * - Un paquete no puede estar a la vez contratado y disponible para contratar.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Sub {
  pid?: unknown;
  title?: unknown;
  shortDescription?: unknown;
  logo?: { type?: unknown; url?: unknown; image?: { type?: unknown; url?: unknown } };
  pricings?: unknown;
}

const logoUrl = (s: Sub) => (s.logo?.url ?? s.logo?.image?.url) as unknown;

test('[MULTISTC-76682] paquetes contratados y disponibles bien formados y sin solaparse', { tag: ['@business'] }, async ({}, testInfo) => {
  const purchased = fromLive('GET nsh/subscriptions/purchased');
  const available = fromLive('GET nsh/subscriptions/available');
  test.skip(!purchased.captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!purchased.samples.length && !available.samples.length, 'La web no abrió Ajustes > TV-Pakete.');

  const bought = ((purchased.samples[0]?.body as { purchased?: unknown })?.purchased ?? null) as Sub[] | null;
  const offer = ((available.samples[0]?.body as { available?: unknown })?.available ?? null) as Sub[] | null;
  testInfo.annotations.push({ type: 'paquetes', description: `contratados: ${bought?.map((s) => s.pid).join(', ') || '—'} · disponibles: ${offer?.map((s) => s.pid).join(', ') || '—'}` });

  if (purchased.samples.length) {
    expect(Array.isArray(bought), 'purchased debe ser una lista (vacía si no hay)').toBe(true);
    for (const s of bought!) {
      expect.soft(typeof s.pid === 'string' && /^SUB/.test(s.pid), `pid ${String(s.pid)}`).toBe(true);
      expect.soft(typeof s.title === 'string' && s.title !== '', `${String(s.pid)}: title`).toBe(true);
      expect.soft(typeof s.shortDescription, `${String(s.pid)}: shortDescription`).toBe('string');
      expect.soft(typeof logoUrl(s) === 'string' && /^https?:\/\//.test(logoUrl(s) as string), `${String(s.pid)}: logo con url`).toBe(true);
    }
  }
  if (available.samples.length) {
    expect(Array.isArray(offer), 'available debe ser una lista (vacía si no hay)').toBe(true);
    for (const s of offer!) {
      expect.soft(typeof s.pid === 'string' && /^SUB/.test(s.pid), `pid ${String(s.pid)}`).toBe(true);
      expect.soft(typeof s.title === 'string' && s.title !== '', `${String(s.pid)}: title`).toBe(true);
      expect.soft(Array.isArray(s.pricings) && (s.pricings as unknown[]).length > 0, `${String(s.pid)}: pricings`).toBe(true);
    }
  }
  if (bought && offer) {
    const both = bought.map((s) => s.pid).filter((p) => offer.some((o) => o.pid === p));
    expect.soft(both, 'paquetes contratados que se ofrecen como disponibles').toEqual([]);
  }
});
