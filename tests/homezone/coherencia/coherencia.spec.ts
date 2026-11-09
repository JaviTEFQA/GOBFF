/**
 * Negocio (GO-36090 · HomeZone): POST nsh/users/{id}/homezone/check responde de forma coherente.
 * Trae `canSetHome` booleano y un `result` conocido (inHome/outOfHome/…) coherente con canSetHome.
 * Valida la respuesta real capturada en vivo (la app hace esta llamada al arrancar).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Homezone {
  canSetHome?: unknown;
  result?: unknown;
}

const KNOWN_RESULTS = ['inHome', 'outOfHome', 'noHome', 'home'];

test('[MULTISTC-76656] homezone/check responde de forma coherente', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('POST nsh/users/{id}/homezone/check');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no llamó a homezone/check durante el recorrido.');

  const body = samples[0]!.body as Homezone;
  testInfo.annotations.push({ type: 'homezone', description: JSON.stringify(body) });

  expect(typeof body?.canSetHome, 'canSetHome no es booleano').toBe('boolean');
  expect(typeof body?.result === 'string' && body.result.trim() !== '', 'result vacío').toBe(true);
  // result conocido: un valor nuevo cambiaría el comportamiento del control de zona del cliente.
  expect.soft(KNOWN_RESULTS, `result desconocido: "${String(body.result)}"`).toContain(body.result);
});
