/**
 * Negocio: cada ficha de detalle (GET nsh/unified-detailed/{pid}) describe su propio contenido.
 * Valida las respuestas REALES capturadas en vivo al abrir fichas (películas, series, directos,
 * grabaciones). La app firma cada petición, así que no se pide a mano: se valida lo que pidió la web.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { loadLiveCapture, liveSamples } from '../../../src/testing/live-capture';

const DETAIL = 'GET nsh/unified-detailed/{pid}';
const PID_RE = /\/([A-Z]{2,5}\d{3,})(?=\/|$|\?)/;

const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';

test('[MULTISTC-76651] cada ficha de detalle describe su propio contenido', { tag: ['@business', '@smoke'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const samples = liveSamples(capture, DETAIL);
  test.skip(!samples.length, `La web no abrió ninguna ficha ${DETAIL} durante el recorrido (journeys detail-*).`);

  testInfo.annotations.push({ type: 'pids', description: samples.map((s) => PID_RE.exec(s.url)?.[1]).filter(Boolean).join(', ') });

  // Soft: se validan todos los tipos (MOV/SER/LSR/REC…) y se informa de cada uno.
  for (const sample of samples) {
    const pid = PID_RE.exec(sample.url)?.[1];
    await test.step(`detalle ${pid ?? sample.url}`, () => {
      expect.soft(sample.status, `${pid}: → ${sample.status}`).toBe(200);
      if (sample.status !== 200 || !sample.isJson) return;
      const body = sample.body as { pid?: unknown; title?: unknown };
      // La ficha debe SER este contenido (su propio pid), no solo mencionarlo en un carrusel relacionado.
      expect.soft(body?.pid, `la ficha de ${pid} describe ${String(body?.pid)}`).toBe(pid);
      expect.soft(nonEmpty(body?.title), `la ficha de ${pid} no tiene título`).toBe(true);
    });
  }
});
