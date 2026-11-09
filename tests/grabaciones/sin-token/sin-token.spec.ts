/**
 * Seguridad · Grabaciones: nsh/recordings y nsh/recordings/storage-info rechazan las llamadas sin token.
 *
 * Control: con la respuesta capturada en vivo se comprueba que CON la sesión del usuario el endpoint
 * responde 2xx (si no, un endpoint caído pasaría por "seguro"). Luego, una llamada DIRECTA sin token
 * debe dar 401/403.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

const PRIVATE = [
  { url: 'nsh/recordings', id: 'GET nsh/recordings' },
  { url: 'nsh/recordings/storage-info', id: 'GET nsh/recordings/storage-info' },
];

for (const { url, id } of PRIVATE) {
  test.describe(`[MULTISTC-76658] ${url}`, { tag: ['@seguridad'] }, () => {
    test('con la sesión del usuario responde 2xx (control)', async () => {
      const { captured, samples } = fromLive(id);
      test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
      test.skip(!samples.length, `La web no llamó a ${id} durante el recorrido: no hay control.`);
      expect(samples[0]!.status, `${id} respondió ${samples[0]!.status} CON sesión`).toBeGreaterThanOrEqual(200);
      expect(samples[0]!.status).toBeLessThan(300);
    });

    test('rechaza las llamadas sin token', async ({ canoway }) => {
      const res = await canoway.send({ url, anonymous: true });
      expect([401, 403], `${url} respondió ${res.status} sin token: ${res.text.slice(0, 200)}`).toContain(res.status);
    });
  });
}
