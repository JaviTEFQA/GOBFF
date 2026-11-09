/**
 * Negocio (GO-33645 / cDVR): las grabaciones y el almacenamiento son coherentes.
 * - storage-info: porcentajes en 0..100 y estado consistente con el uso (over-quota ⇒ lleno),
 * - recordings: cada agendada trae pid, channelPid y una fecha de emisión válida.
 * Valida las respuestas reales capturadas en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Scheduled {
  pid?: unknown;
  channelPid?: unknown;
  emissionDate?: { start?: unknown } | null;
}

test('[MULTISTC-76653] storage-info coherente y grabaciones agendadas bien formadas', { tag: ['@business'] }, async ({}, testInfo) => {
  const storage = fromLive('GET nsh/recordings/storage-info');
  const recordings = fromLive('GET nsh/recordings');
  test.skip(!storage.captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!storage.samples.length || !recordings.samples.length, 'La web no llamó a recordings/storage-info durante el recorrido.');

  const info = (storage.samples[0]!.body as { storageInfo?: Record<string, unknown> }).storageInfo ?? {};
  testInfo.annotations.push({ type: 'storage', description: JSON.stringify(info) });

  const used = info.usedPercentage as number;
  const pct = info.percentage as number;
  const warn = info.warningThreshold as number;
  expect(typeof used, 'usedPercentage no es número').toBe('number');
  expect(used, 'usedPercentage fuera de 0..100').toBeGreaterThanOrEqual(0);
  expect(used, 'usedPercentage fuera de 0..100').toBeLessThanOrEqual(100);
  expect(pct, 'percentage fuera de 0..100').toBeGreaterThanOrEqual(0);
  expect(pct, 'percentage fuera de 0..100').toBeLessThanOrEqual(100);

  // Si está marcado "over-quota", el uso debe estar por encima del umbral de aviso (coherencia).
  if (info.usedState === 'over-quota') {
    expect.soft(used, `over-quota pero usedPercentage ${used} < umbral ${warn}`).toBeGreaterThanOrEqual(warn);
  }

  const body = recordings.samples[0]!.body as { recordings?: { scheduled?: unknown } };
  const scheduled = (Array.isArray(body?.recordings?.scheduled) ? body!.recordings!.scheduled : []) as Scheduled[];
  testInfo.annotations.push({ type: 'scheduled', description: `${scheduled.length} agendadas` });

  // Cada agendada debe poder abrirse (pid), situarse en su canal (channelPid) y ordenarse por fecha.
  const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const broken = scheduled.filter((r) => !nonEmpty(r.pid) || !nonEmpty(r.channelPid) || typeof r.emissionDate?.start !== 'number');
  expect.soft(broken.slice(0, 10).map((r) => JSON.stringify(r).slice(0, 100)), `${broken.length} grabaciones agendadas sin pid/channelPid/fecha`).toEqual([]);
});
