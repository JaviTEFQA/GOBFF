/**
 * Negocio: la rejilla "ver todo" (nsh/thematic-grid-page/{pid}) pagina de forma coherente.
 * Trae una lista de contenidos no vacía, `page` numérico y, cuando hay más, `nextPage === page + 1`.
 * Valida la respuesta real capturada en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface GridBody {
  page?: unknown;
  nextPage?: unknown;
  thematicGrid?: { contents?: unknown; orderList?: unknown } | null;
}

test('[MULTISTC-76650] la rejilla pagina de forma coherente', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/thematic-grid-page/{pid}');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no abrió ninguna rejilla "ver todo" durante el recorrido.');

  for (const sample of samples) {
    const body = sample.body as GridBody;
    await test.step(sample.key, () => {
      const contents = body.thematicGrid?.contents;
      expect(Array.isArray(contents), 'thematicGrid.contents no es lista').toBe(true);
      expect((contents as unknown[]).length, 'rejilla sin contenidos').toBeGreaterThan(0);
      expect(typeof body.page, 'page no es número').toBe('number');
      expect(Array.isArray(body.thematicGrid?.orderList), 'orderList no es lista').toBe(true);

      // Si anuncia página siguiente, debe ser la inmediatamente posterior (sin saltos ni bucles).
      if (body.nextPage !== undefined && body.nextPage !== null) {
        expect.soft(body.nextPage, `nextPage ${String(body.nextPage)} no es page+1 (${(body.page as number) + 1})`).toBe((body.page as number) + 1);
      }
      testInfo.annotations.push({ type: 'paging', description: `page ${String(body.page)} → next ${String(body.nextPage)} (${(contents as unknown[]).length} items)` });
    });
  }
});
