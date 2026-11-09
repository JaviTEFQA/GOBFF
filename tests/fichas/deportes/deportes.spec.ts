/**
 * Negocio (GO-36571 · Sports details page + grouping). En la ficha de una serie en directo (LSR):
 * - `isSport` se propaga como booleano (MULTISTC-67886);
 * - isSport=false → comportamiento estándar: sin filtrar el episodio relevante de la temporada (67887, 67890);
 * - isSport=true → cada season trae title (67888), los botones de grabar serie/temporada van a false (67891),
 *   renderChild=false al entrar por la LSR (67892) y, con renderChild=true, el episodio relevante no se
 *   repite en el carrusel de la temporada (67889).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { at } from '../../../src/testing/content-items';
import { loadLiveCapture } from '../../../src/testing/live-capture';

interface Detail {
  pid: string;
  isSport?: unknown;
  renderChild?: unknown;
  seasons?: { title?: unknown; pid?: string }[];
  relevantEpisode?: { pid?: string; buttons?: Record<string, unknown> };
  relevantSeason?: { episodes?: { pid?: string }[] };
}

test('[MULTISTC-76680] isSport se propaga y activa la lógica deportiva solo cuando es true', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const lsr = (capture!.endpoints['GET nsh/unified-detailed/{pid}'] ?? []).map((s) => ({ key: s.key, d: s.body as Detail })).filter((x) => /^LSR/.test(x.d.pid));
  test.skip(!lsr.length, 'La web no abrió ninguna ficha LSR.');
  testInfo.annotations.push({ type: 'LSR', description: lsr.map((x) => `${x.d.pid} isSport=${String(x.d.isSport)}`).join(', ') });

  for (const { key, d } of lsr) {
    expect.soft(typeof d.isSport, `${key}: isSport`).toBe('boolean');
    const episodes = (d.relevantSeason?.episodes ?? []).map((e) => e.pid);
    const relevant = d.relevantEpisode?.pid;
    if (d.isSport === true) {
      for (const s of d.seasons ?? []) expect.soft(typeof s.title === 'string' && s.title !== '', `${key}: season ${s.pid} sin title (67888)`).toBe(true);
      expect.soft(at(d, 'relevantEpisode.buttons.isRecordingSeriesVisible') === true, `${key}: grabar serie visible en deporte (67891)`).toBe(false);
      expect.soft(at(d, 'relevantEpisode.buttons.isRecordingSeasonVisible') === true, `${key}: grabar temporada visible en deporte (67891)`).toBe(false);
      if (d.renderChild === true && relevant) expect.soft(episodes.includes(relevant), `${key}: episodio relevante repetido en la temporada (67889)`).toBe(false);
    }
  }
  if (!lsr.some((x) => x.d.isSport === true)) testInfo.annotations.push({ type: 'aviso', description: 'Ninguna LSR deportiva en esta captura: las reglas de isSport=true no se han podido comprobar.' });
});
