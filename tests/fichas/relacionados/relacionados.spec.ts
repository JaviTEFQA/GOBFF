/**
 * Negocio (GO-36810 · Detail Page, área inferior: Relacionados, solo Similares).
 * - Con relacionados, la ficha trae `relatedContents` = { collectionLayoutStyle: 'portraitSmall',
 *   type: 'category', contents: [≥1] } sin pid/title/refreshAfter/showAllPid/showGrid/isMoreContentsEnabled (MULTISTC-65576).
 * - Sin relacionados, el campo no aparece: ni null, ni [], ni {} (65577).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { loadLiveCapture } from '../../../src/testing/live-capture';

const FORBIDDEN = ['pid', 'title', 'refreshAfter', 'showAllPid', 'showGrid', 'isMoreContentsEnabled'];

test('[MULTISTC-76677] relatedContents tiene la forma de "Similares" o no aparece', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const details = capture!.endpoints['GET nsh/unified-detailed/{pid}'] ?? [];
  test.skip(!details.length, 'La web no abrió ninguna ficha.');

  let withRelated = 0;
  for (const s of details) {
    const body = s.body as Record<string, unknown>;
    if (!('relatedContents' in body)) continue;
    const rc = body.relatedContents as Record<string, unknown> | null;
    // 65577: si no hay relacionados, el campo no debe venir vacío.
    expect.soft(rc && typeof rc === 'object' && !Array.isArray(rc) && Object.keys(rc).length > 0, `${s.key}: relatedContents vacío (debe omitirse)`).toBe(true);
    if (!rc || typeof rc !== 'object' || Array.isArray(rc)) continue;
    withRelated++;
    // 65576: forma de la colección "Similares".
    expect.soft(rc.collectionLayoutStyle, `${s.key}: collectionLayoutStyle`).toBe('portraitSmall');
    expect.soft(rc.type, `${s.key}: type`).toBe('category');
    expect.soft(Array.isArray(rc.contents) && rc.contents.length > 0, `${s.key}: contents con ≥1 elemento`).toBe(true);
    expect.soft(FORBIDDEN.filter((k) => k in rc), `${s.key}: campos que no deben estar en relatedContents`).toEqual([]);
  }
  testInfo.annotations.push({ type: 'fichas', description: `${details.length} fichas, ${withRelated} con relacionados` });
});
