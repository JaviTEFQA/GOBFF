/**
 * tests/setup/live-capture.setup.ts — Captura en vivo previa a las pruebas de API.
 *
 * Abre un único navegador logado, recorre la app y guarda las respuestas reales de canoway en
 * .live/<versión>/capture.json. Las pruebas de contrato y de negocio leen de ese fichero, porque
 * canoway firma cada petición y no se pueden reenviar peticiones a mano.
 *
 * Es una dependencia del proyecto `api` (ver playwright.config.ts): se ejecuta una sola vez.
 * Reutilizable: si ya hay una captura reciente se omite (LIVE_CAPTURE_TTL_MIN), para no abrir el
 * navegador en cada tanda. Fuerza una nueva con LIVE_CAPTURE_FORCE=true.
 */
import { test as setup } from '@playwright/test';
import { captureLive, loadLiveCapture } from '../../src/testing/live-capture';

const TTL_MIN = Number(process.env.LIVE_CAPTURE_TTL_MIN ?? 15);

setup('capture live BFF responses', async () => {
  setup.setTimeout(900_000);
  // Captura sustituida (sintética): nunca se reescribe ni se abre el navegador.
  if (process.env.LIVE_CAPTURE_FILE) {
    if (!loadLiveCapture()) throw new Error(`LIVE_CAPTURE_FILE=${process.env.LIVE_CAPTURE_FILE} no existe o no es JSON válido.`);
    console.log(`[live] usando la captura ${process.env.LIVE_CAPTURE_FILE} (no se captura).`);
    return;
  }
  const force = process.env.LIVE_CAPTURE_FORCE === 'true';
  const existing = loadLiveCapture();
  if (!force && existing) {
    const ageMin = (Date.now() - new Date(existing.capturedAt).getTime()) / 60_000;
    const total = Object.values(existing.endpoints).reduce((n, l) => n + l.length, 0);
    if (ageMin < TTL_MIN && total > 0) {
      console.log(`[live] captura reciente (${ageMin.toFixed(1)} min, ${total} samples): se reutiliza. LIVE_CAPTURE_FORCE=true para rehacerla.`);
      return;
    }
  }
  await captureLive();
});
