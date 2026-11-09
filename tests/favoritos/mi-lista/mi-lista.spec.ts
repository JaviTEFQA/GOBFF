/**
 * Mutación: añadir un contenido a "Meine Liste" (favoritos) y quitarlo.
 * Patrón hacer → verificar → deshacer, moviendo la UI (la app firma la llamada):
 *   1. abre la ficha de una película que NO esté ya en la lista (`tags.favorite=false`),
 *   2. pulsa "Auf meine Liste" → `PUT nsh/tags` con `{Pid, TagType:2}`,
 *   3. verifica en la ficha `tags.favorite=true` e `isRemoveMyListVisible=true`,
 *   4. DESHACE con "Aus Liste löschen" → `DELETE nsh/tags` y verifica `tags.favorite=false`.
 * El estado se lee del BFF en una segunda pestaña: la web guarda el estado de la lista en memoria y,
 * al volver a la ficha en la misma pestaña, puede seguir mostrando el botón anterior.
 * Nunca toca un contenido que ya estuviera en la lista. Apagada salvo API_ALLOW_MUTATIONS=true.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../../../src/testing/fixtures';
import { env } from '../../../src/config/env';
import { goToApp, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, readCanoway } from '../../../src/testing/mutation';

const ADD = 'Auf meine Liste';
const REMOVE = 'Aus Liste löschen';
const TAGS = /\/nsh\/tags$/;
type Detail = { pid?: string; tags?: { favorite?: boolean }; buttons?: Record<string, boolean> };

/** Abre la ficha (pasando por otra pantalla para forzar la recarga) y devuelve su respuesta. */
async function detail(page: Page, href: string): Promise<Detail> {
  await goToApp(page, '/my-tv');
  await settle(page, 1000);
  const hit = await readCanoway(page, { pathRe: /\/nsh\/unified-detailed\/MOV/, navigate: () => goToApp(page, href), timeout: 30_000 });
  await settle(page, 1500);
  return hit.json as Detail;
}

/**
 * Lee la ficha en una pestaña nueva hasta que `tags.favorite` sea `want` (el cambio tarda unos
 * segundos en propagarse) o se agoten los intentos; devuelve la última respuesta.
 */
async function favoriteState(page: Page, href: string, want: boolean): Promise<Detail> {
  let last: Detail = {};
  for (let i = 0; i < 4; i++) {
    const probe = await page.context().newPage();
    last = await detail(probe, href).finally(() => probe.close());
    if (last.tags?.favorite === want) break;
    await page.waitForTimeout(5000);
  }
  return last;
}

test.describe('[MULTISTC-76699] favoritos: añadir a Meine Liste y quitar', { tag: ['@mutation', '@favorites'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');

  test('añade una película a la lista y la quita', async ({ page }, testInfo) => {
    test.setTimeout(360_000);
    // 1. Película que no esté en la lista.
    await goToApp(page, '/catalog/videothek-15640');
    await settle(page, 2500);
    const hrefs = [...new Set(await page.locator('a[href*="/details/movie/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')))].filter(Boolean).slice(0, 6);
    let href: string | null = null;
    let before: Detail | null = null;
    for (const h of hrefs) {
      const d = await detail(page, h);
      if (d.tags?.favorite === false && d.buttons?.isAddMyListVisible === true) {
        href = h;
        before = d;
        break;
      }
    }
    test.skip(!href, 'Ninguna película de la Videothek fuera de la lista.');
    testInfo.annotations.push({ type: 'contenido', description: `${before!.pid} (${href})` });

    // 2. HACER.
    let added = false;
    try {
      const put = await awaitCanoway(page, { method: 'PUT', pathRe: TAGS, trigger: () => page.getByRole('button', { name: ADD }).click() });
      testInfo.annotations.push({ type: 'añadir', description: `PUT nsh/tags → ${put.status}` });
      added = put.status < 400;
      expect(put.status, 'añadir a la lista no respondió 2xx').toBeLessThan(300);

      await page.getByRole('button', { name: REMOVE }).waitFor({ state: 'visible', timeout: 10_000 });
      // 3. VERIFICAR (estado del BFF, en otra pestaña).
      const after = await favoriteState(page, href!, true);
      expect(after.tags?.favorite, 'la ficha no marca tags.favorite tras añadir').toBe(true);
      expect.soft(after.buttons?.isRemoveMyListVisible, 'tras añadir debe ofrecer quitar de la lista').toBe(true);
      expect.soft(after.buttons?.isAddMyListVisible, 'tras añadir no debe ofrecer añadir').toBe(false);
    } finally {
      // 4. DESHACER.
      if (added) {
        try {
          const del = await awaitCanoway(page, { method: 'DELETE', pathRe: TAGS, trigger: () => page.getByRole('button', { name: REMOVE }).click() });
          testInfo.annotations.push({ type: 'quitar', description: `DELETE nsh/tags → ${del.status}` });
          expect(del.status, 'quitar de la lista no respondió 2xx').toBeLessThan(300);
          const final = await favoriteState(page, href!, false);
          expect(final.tags?.favorite, 'el contenido sigue en la lista tras quitarlo').toBe(false);
        } catch (e) {
          throw new Error(`TEARDOWN FALLIDO: ${before!.pid} puede seguir en Meine Liste. Quitarlo desde su ficha ("${REMOVE}").\n${String(e)}`);
        }
      }
    }
  });
});
