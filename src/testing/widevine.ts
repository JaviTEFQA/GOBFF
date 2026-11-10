/**
 * src/testing/widevine.ts — `test` con un navegador capaz de reproducir DRM (Widevine).
 *
 * El Chromium de Playwright no trae Widevine y, además, Playwright arranca Chrome con
 * `--disable-component-update`, que impide cargar el CDM. Para reproducir de verdad:
 *   - Chrome instalado (`channel: 'chrome'`, que trae el CDM de serie),
 *   - contexto persistente (perfil propio en la carpeta de resultados de la prueba, nuevo cada vez),
 *   - sin `--disable-component-update`.
 * Los contextos persistentes no aceptan `storageState`, así que la sesión guardada (`.auth`) se
 * inyecta a mano: cookies con `addCookies` y localStorage con un script de inicio que solo siembra
 * cada origen la primera vez (después la app manda sobre su propio almacenamiento).
 *
 * Uso: `import { test, expect } from '../../../src/testing/widevine'`.
 */
import * as fs from 'fs';
import { chromium, type BrowserContext } from '@playwright/test';
import { env, paths } from '../config/env';
import { test as base, expect } from './fixtures';

const SEED_FLAG = '__qa_widevine_seeded';

interface StorageState {
  cookies: Parameters<BrowserContext['addCookies']>[0];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/** true si el navegador acepta el sistema de claves Widevine. */
export async function widevineAvailable(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(async () => {
    try {
      await navigator.requestMediaKeySystemAccess('com.widevine.alpha', [
        { initDataTypes: ['cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }] },
      ]);
      return true;
    } catch {
      return false;
    }
  });
}

export const test = base.extend({
  context: async ({ headless }, use, testInfo) => {
    const ctx = await chromium.launchPersistentContext(testInfo.outputPath('chrome-profile'), {
      channel: 'chrome',
      headless,
      ignoreDefaultArgs: ['--disable-component-update'],
      viewport: { width: 1600, height: 900 },
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      baseURL: env.appUrl,
      httpCredentials: env.httpCredentials,
    });
    if (fs.existsSync(paths.storageState)) {
      const state = JSON.parse(fs.readFileSync(paths.storageState, 'utf8')) as StorageState;
      await ctx.addCookies(state.cookies);
      await ctx.addInitScript(
        ({ origins, flag }) => {
          const o = origins.find((x) => x.origin === location.origin);
          if (!o || localStorage.getItem(flag)) return;
          for (const { name, value } of o.localStorage) localStorage.setItem(name, value);
          localStorage.setItem(flag, '1');
        },
        { origins: state.origins, flag: SEED_FLAG },
      );
    }
    await use(ctx);
    await ctx.close();
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? (await context.newPage()));
  },
});

export { expect };
