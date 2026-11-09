/**
 * Negocio (GO-36297 · Recordings: endpoint unified-detail). La ficha de una serie grabada
 * (`unified-detailed/RSR…`) devuelve el árbol de grabaciones:
 * - seasons (RSE…) con sus episodios (REC…) y, si hay programadas, la season `isFutureSeason` (MULTISTC-68552);
 * - sin relevantSeason: una única season relevante y, dentro, un único REC relevante (68553);
 * - la season de programadas ordenada por fecha de emisión ascendente (68553);
 * - como mucho un botón de cancelación por grabación (nivel episodio, serie o temporada: 68554);
 * - reproducir sobre el directo (`isSchedulePlay…`) solo en grabaciones en curso (68555);
 * - una grabación futura no se puede reproducir ni borrar, y una terminada no se puede cancelar.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at } from '../../../src/testing/content-items';
import { fromLive } from '../../../src/testing/live-capture';

interface Rec {
  pid?: string;
  isRelevant?: unknown;
  emissionDate?: { start: number; end: number };
  buttons?: Record<string, unknown>;
}
interface Season {
  pid?: string;
  isRelevant?: unknown;
  isFutureSeason?: unknown;
  episodes?: Rec[];
}

const CANCEL = ['isRecordingCancelSingleVisible', 'isRecordingCancelSeriesVisible', 'isRecordingCancelSeasonVisible'];
const MARGIN_S = 120;

test('[MULTISTC-76686] la ficha de una serie grabada devuelve un árbol de grabaciones coherente', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/unified-detailed/{pid}');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const rsr = samples.filter((s) => /^RSR/.test(String((s.body as { pid?: unknown }).pid)));
  test.skip(!rsr.length, 'La web no abrió ninguna serie grabada (journeys detail-recording-serie/-scheduled).');

  for (const s of rsr) {
    const d = s.body as { pid: string; seasons?: Season[]; relevantSeason?: unknown };
    const now = (s.at ?? Date.now()) / 1000;
    const seasons = d.seasons ?? [];
    const recs = seasons.flatMap((se) => (se.episodes ?? []).map((r) => ({ se, r })));
    testInfo.annotations.push({ type: d.pid, description: `${seasons.length} seasons · ${recs.length} grabaciones · futuras: ${seasons.filter((x) => x.isFutureSeason === true).map((x) => x.episodes?.length).join(',') || 0}` });

    // 68552: árbol RSE → REC.
    expect.soft(seasons.length, `${d.pid}: sin seasons`).toBeGreaterThan(0);
    expect.soft(seasons.filter((se) => !/^RSE/.test(String(se.pid))).map((se) => se.pid), `${d.pid}: seasons que no son RSE`).toEqual([]);
    expect.soft(recs.filter(({ r }) => !/^REC/.test(String(r.pid))).map(({ r }) => r.pid).slice(0, 10), `${d.pid}: episodios que no son REC`).toEqual([]);

    // 68553: foco por isRelevant, sin relevantSeason.
    expect.soft('relevantSeason' in d, `${d.pid}: no debe traer relevantSeason`).toBe(false);
    const relSeasons = seasons.filter((se) => se.isRelevant === true);
    expect.soft(relSeasons.length, `${d.pid}: seasons relevantes`).toBe(1);
    if (relSeasons.length === 1) expect.soft((relSeasons[0]!.episodes ?? []).filter((r) => r.isRelevant === true).length, `${d.pid}: REC relevantes en la season relevante`).toBe(1);
    for (const se of seasons.filter((x) => x.isFutureSeason === true)) {
      const starts = (se.episodes ?? []).map((r) => r.emissionDate?.start ?? 0);
      expect.soft(starts.every((v, i) => i === 0 || v >= starts[i - 1]!), `${d.pid}: season de programadas no ordenada por emisión ascendente`).toBe(true);
    }

    for (const { se, r } of recs) {
      const id = `${d.pid}/${r.pid}`;
      // 68554: un único nivel de cancelación por grabación.
      expect.soft(CANCEL.filter((k) => at(r, `buttons.${k}`) === true).length, `${id}: más de un botón de cancelar`).toBeLessThanOrEqual(1);
      const e = r.emissionDate;
      if (!e) continue;
      const ongoing = e.start < now - MARGIN_S && e.end > now + MARGIN_S;
      const finished = e.end < now - MARGIN_S;
      const future = e.start > now + MARGIN_S;
      // 68555: reproducir sobre el directo solo en curso.
      if (!ongoing && (finished || future)) {
        expect.soft(at(r, 'buttons.isSchedulePlayVisible') === true, `${id}: isSchedulePlayVisible fuera de emisión`).toBe(false);
        expect.soft(at(r, 'buttons.isSchedulePlayFromBeginningVisible') === true, `${id}: isSchedulePlayFromBeginningVisible fuera de emisión`).toBe(false);
      }
      if (future || se.isFutureSeason === true) {
        expect.soft(at(r, 'buttons.isRecordingPlayVisible') === true, `${id}: programada con reproducir`).toBe(false);
        expect.soft(at(r, 'buttons.isRecordingDeleteSingleVisible') === true, `${id}: programada con borrar`).toBe(false);
      }
      if (finished && se.isFutureSeason !== true) expect.soft(CANCEL.some((k) => at(r, `buttons.${k}`) === true), `${id}: terminada con cancelar`).toBe(false);
    }
  }
});
