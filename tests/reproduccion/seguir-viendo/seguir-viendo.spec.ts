/**
 * Mutación: reproducir una película (DRM real), comprobar que queda en "seguir viendo" y quitarla.
 * Patrón hacer → verificar → deshacer, moviendo la UI (la app firma las llamadas):
 *   1. abre la ficha de una película de la Mediathek SIN punto de reanudación,
 *   2. pulsa "Sehen" y deja reproducir ~45 s (licencia Widevine real),
 *   3. verifica en la ficha `playback.resume.time > 0`, `isStopWatchingVisible=true`, `tags.watched=true`,
 *   4. DESHACE con "Fertig" > "Ok" → `DELETE nsh/personal-contents {contentPids, actionTypeId:1}` y
 *      verifica que vuelve al estado inicial (sin resume, `watched=false`).
 * Necesita Widevine: usa el `test` de src/testing/widevine.ts (Chrome instalado, perfil propio).
 * El estado se lee en pestañas nuevas: la web guarda la ficha en memoria. Apagada salvo API_ALLOW_MUTATIONS=true.
 */
import type { Page } from '@playwright/test';
import { env } from '../../../src/config/env';
import { goToApp, scrollThrough, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, readCanoway } from '../../../src/testing/mutation';
import { expect, test, widevineAvailable } from '../../../src/testing/widevine';

const PERSONAL = /\/nsh\/personal-contents$/;
const PLAY_SECONDS = 45;
type Detail = {
  pid?: string;
  tags?: { watched?: boolean; completed?: boolean };
  buttons?: { isStopWatchingVisible?: boolean; isPlayVisible?: boolean };
  playback?: { resume?: { time?: number } | null };
};

/** Abre la ficha (pasando por otra pantalla para forzar la recarga) y devuelve su respuesta. */
async function detail(page: Page, href: string): Promise<Detail> {
  await goToApp(page, '/my-tv');
  await settle(page, 1000);
  const hit = await readCanoway(page, { pathRe: /\/nsh\/unified-detailed\/MOV/, navigate: () => goToApp(page, href), timeout: 30_000 });
  await settle(page, 2000);
  return hit.json as Detail;
}

/** Lee la ficha en una pestaña nueva hasta que `ok` se cumpla (el cambio tarda en propagarse). */
async function stateUntil(page: Page, href: string, ok: (d: Detail) => boolean): Promise<Detail> {
  let last: Detail = {};
  for (let i = 0; i < 4; i++) {
    const probe = await page.context().newPage();
    last = await detail(probe, href).finally(() => probe.close());
    if (ok(last)) break;
    await page.waitForTimeout(5000);
  }
  return last;
}

const inProgress = (d: Detail) => (d.playback?.resume?.time ?? 0) > 0 && d.buttons?.isStopWatchingVisible === true;
const clean = (d: Detail) => !d.playback?.resume && d.buttons?.isStopWatchingVisible !== true;

test.describe('[MULTISTC-76702] seguir viendo: reproducir, reanudar y quitar', { tag: ['@mutation', '@playback'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');

  test('reproduce una película, queda para reanudar y se quita con Fertig', async ({ page }, testInfo) => {
    test.setTimeout(420_000);
    await goToApp(page, '/catalog/mediathek-14798');
    await settle(page, 2000);
    test.skip(!(await widevineAvailable(page)), 'El navegador no tiene Widevine (hace falta Chrome instalado).');

    // 1. Película sin punto de reanudación.
    await scrollThrough(page, 6);
    const hrefs = [...new Set(await page.locator('a[href*="/details/movie/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '')))]
      .filter(Boolean)
      .slice(0, 12);
    let href: string | null = null;
    let before: Detail | null = null;
    for (const h of hrefs) {
      const d = await detail(page, h);
      if (clean(d) && d.buttons?.isPlayVisible === true && d.tags?.watched === false) {
        href = h;
        before = d;
        break;
      }
    }
    test.skip(!href, 'Ninguna película de la Mediathek sin punto de reanudación.');
    testInfo.annotations.push({ type: 'contenido', description: `${before!.pid} (${href})` });

    let played = false;
    try {
      // 2. HACER: reproducir.
      await page.getByRole('button', { name: /^Sehen$/ }).first().click();
      played = true;
      await expect
        .poll(
          () => page.evaluate(() => {
            const v = document.querySelector('video');
            if (v?.error) throw new Error(`error del reproductor ${v.error.code}: ${v.error.message}`);
            return v?.currentTime ?? 0;
          }),
          { message: `el vídeo no llega a ${PLAY_SECONDS} s de reproducción (¿DRM?)`, timeout: 150_000, intervals: [5000] },
        )
        .toBeGreaterThanOrEqual(PLAY_SECONDS);
      await page.goBack().catch(() => {});
      await settle(page, 3000);

      // 3. VERIFICAR (estado del BFF, en otra pestaña).
      const after = await stateUntil(page, href!, inProgress);
      testInfo.annotations.push({ type: 'resume', description: JSON.stringify(after.playback?.resume ?? null) });
      expect(after.playback?.resume?.time ?? 0, 'la ficha no guarda punto de reanudación').toBeGreaterThan(0);
      expect(after.buttons?.isStopWatchingVisible, 'la ficha no ofrece quitar de seguir viendo').toBe(true);
      expect.soft(after.tags?.watched, 'tras reproducir, tags.watched debe ser true').toBe(true);
    } finally {
      // 4. DESHACER.
      if (played) {
        try {
          const tab = await page.context().newPage();
          await detail(tab, href!);
          const done = tab.getByRole('button', { name: /^Fertig$/ });
          if (await done.isVisible().catch(() => false)) {
            await done.click();
            const del = await awaitCanoway(tab, { method: 'DELETE', pathRe: PERSONAL, trigger: () => tab.getByRole('button', { name: /^Ok$/ }).click() });
            testInfo.annotations.push({ type: 'quitar', description: `DELETE nsh/personal-contents → ${del.status}` });
            expect(del.status, 'quitar de seguir viendo no respondió 2xx').toBeLessThan(300);
          }
          await tab.close();
          const final = await stateUntil(page, href!, (d) => clean(d) && d.tags?.watched === false);
          expect(clean(final), 'la película sigue en seguir viendo').toBe(true);
          expect(final.tags?.watched, 'la película sigue marcada como vista').toBe(false);
        } catch (e) {
          throw new Error(`TEARDOWN FALLIDO: ${before!.pid} puede seguir en "seguir viendo". Quitarla desde su ficha ("Fertig" > "Ok").\n${String(e)}`);
        }
      }
    }
  });
});
