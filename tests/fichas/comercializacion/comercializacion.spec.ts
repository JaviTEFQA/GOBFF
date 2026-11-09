/**
 * Negocio (GO-36297 / comercialización): la comercialización del detalle es coherente.
 * Cada ficha (nsh/unified-detailed/{pid}) trae `commercialization` con `isTvod`/`isSubscribable`
 * booleanos, y una película TVOD (isTvod === true) debe traer `pricings` no vacío (si no, no se
 * puede alquilar). Valida las respuestas reales capturadas en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Detail {
  pid?: unknown;
  commercialization?: { isTvod?: unknown; isSubscribable?: unknown } | null;
  pricings?: unknown;
}

const PID_RE = /\/([A-Z]{2,5}\d{3,}(?:_[A-Z]{2,5}\d{3,})*)(?=\/|$|\?)/;
const isBool = (v: unknown) => typeof v === 'boolean';

test('[MULTISTC-76652] la comercialización del detalle es coherente', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/unified-detailed/{pid}');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no abrió ninguna ficha durante el recorrido.');

  // Las series grabadas (RSR) son un árbol de grabaciones, sin comercialización.
  for (const sample of samples.filter((s) => !/unified-detailed\/RSR/.test(s.shape))) {
    const pid = PID_RE.exec(sample.url)?.[1] ?? sample.url;
    const body = sample.body as Detail;
    await test.step(`detalle ${pid}`, () => {
      const c = body?.commercialization;
      expect.soft(isBool(c?.isTvod), `${pid}: commercialization.isTvod no es booleano`).toBe(true);
      expect.soft(isBool(c?.isSubscribable), `${pid}: commercialization.isSubscribable no es booleano`).toBe(true);
      // Una película TVOD debe traer precios; sin ellos no se puede alquilar.
      if (c?.isTvod === true) {
        const hasPricings = Array.isArray(body.pricings) && body.pricings.length > 0;
        expect.soft(hasPricings, `${pid}: es TVOD pero no trae pricings`).toBe(true);
      }
    });
  }
  testInfo.annotations.push({ type: 'pids', description: samples.map((s) => PID_RE.exec(s.url)?.[1]).filter(Boolean).join(', ') });
});
