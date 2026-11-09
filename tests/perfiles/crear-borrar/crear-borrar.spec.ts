/**
 * Mutación: crear un perfil y borrarlo.
 * Patrón hacer → verificar → deshacer, moviendo la UI (la app firma las llamadas):
 *   1. "Profil hinzufügen": Jugendschutz-PIN (`CheckPin`), avatar y nombre "QA BFF <hhmm>" → alta.
 *   2. VERIFICA en `GET nsh/profiles` que aparece con ese nombre (y que no es el perfil por defecto).
 *   3. DESHACE: "<nombre> ändern" → "Löschen" → "Fortsetzen" → `DELETE nsh/profiles/{id}`.
 *   4. VERIFICA que ya no está en `nsh/profiles`.
 * Solo actúa sobre el perfil que crea (nombre único). Si la cuenta ya tiene el máximo de perfiles
 * (`isProfileAddEnabled=false`), se omite. PIN: PARENTAL_PIN en .env (nunca en el código).
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../../../src/testing/fixtures';
import { appRoute, env } from '../../../src/config/env';
import { goToApp, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, readCanoway } from '../../../src/testing/mutation';

const PIN = process.env.PARENTAL_PIN ?? '';
const PROFILES = /\/nsh\/profiles$/;
type Profiles = { profiles?: { id?: number; name?: string; isDefaultProfile?: boolean }[]; isProfileAddEnabled?: boolean };

/**
 * Lee `nsh/profiles` cargando la app en una pestaña nueva (dentro de la app la lista va en caché) y deja
 * la pestaña principal en la pantalla de perfiles.
 */
async function profiles(page: Page): Promise<Profiles> {
  const probe = await page.context().newPage();
  try {
    const hit = await readCanoway(probe, { pathRe: PROFILES, navigate: async () => void (await probe.goto(appRoute('/profiles/list'))), timeout: 30_000 });
    return hit.json as Profiles;
  } finally {
    await probe.close();
    await goToApp(page, '/profiles/list');
    await settle(page, 2000);
  }
}

test.describe('[MULTISTC-76701] perfiles: crear un perfil y borrarlo', { tag: ['@mutation', '@profiles'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');
  test.skip(!/^\d{4}$/.test(PIN), 'Falta PARENTAL_PIN (Jugendschutz-PIN de la cuenta) en .env.');

  test('crea un perfil de prueba y lo borra', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const name = `QA BFF ${new Date().toISOString().slice(11, 16).replace(':', '')}`;
    const before = await profiles(page);
    testInfo.annotations.push({ type: 'perfiles antes', description: (before.profiles ?? []).map((p) => p.name).join(', ') });
    test.skip(before.isProfileAddEnabled !== true, 'La cuenta ya tiene el máximo de perfiles (isProfileAddEnabled=false).');
    test.skip((before.profiles ?? []).some((p) => p.name === name), `Ya existe un perfil "${name}".`);

    // 1. HACER: PIN → avatar → nombre.
    await page.getByRole('button', { name: 'Profil hinzufügen' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[name="code"]').fill(PIN);
    const check = await awaitCanoway(page, { method: 'GET', pathRe: /UserService\.svc\/CheckPin$/, trigger: () => dialog.getByRole('button', { name: 'Ok' }).click() });
    expect((check.json as { Content?: unknown } | null)?.Content, 'el Jugendschutz-PIN (PARENTAL_PIN) no es válido').toBe(true);
    await page.waitForURL(/\/profiles\/avatar/, { timeout: 15_000 });
    await settle(page, 1500);
    await page.locator('main img, button img').first().click();
    await page.waitForURL(/\/profiles\/name/, { timeout: 15_000 });
    await page.locator('input[name="name"]').fill(name);
    let created = false;
    try {
      const add = await awaitCanoway(page, { method: /^(POST|PUT)$/, pathRe: /\/nsh\/profiles/, trigger: () => page.getByRole('button', { name: 'Ok' }).click() });
      testInfo.annotations.push({ type: 'alta', description: `${add.method} ${new URL(add.url).pathname.replace(/^.*service\//, '')} → ${add.status}` });
      created = add.status < 400;
      expect(add.status, 'el alta del perfil no respondió 2xx').toBeLessThan(300);

      // 2. VERIFICAR.
      const after = await profiles(page);
      const mine = (after.profiles ?? []).find((p) => p.name === name);
      expect(mine, `el perfil "${name}" no aparece en nsh/profiles`).toBeTruthy();
      expect.soft(mine?.isDefaultProfile, 'el perfil nuevo no debe ser el de por defecto').toBe(false);
      expect.soft((after.profiles ?? []).length, 'número de perfiles tras el alta').toBe((before.profiles ?? []).length + 1);
    } finally {
      // 3. DESHACER (también si el alta no confirmó: puede haberse creado).
      const now = await profiles(page);
      const mine = (now.profiles ?? []).find((p) => p.name === name);
      if (mine) {
        try {
          await page.getByRole('button', { name: `${name} ändern`, exact: true }).click();
          await page.waitForURL(/\/profiles\/name/, { timeout: 15_000 });
          expect(await page.locator('input[name="name"]').inputValue(), 'la pantalla de edición no es la del perfil de prueba').toBe(name);
          await page.getByRole('button', { name: 'Löschen', exact: true }).click();
          const del = await awaitCanoway(page, { method: 'DELETE', pathRe: /\/nsh\/profiles\/\d+$/, trigger: () => page.getByRole('dialog').getByRole('button', { name: 'Fortsetzen' }).click() });
          testInfo.annotations.push({ type: 'borrado', description: `DELETE ${new URL(del.url).pathname.replace(/^.*service\//, '')} → ${del.status}` });
          expect(del.status, 'el borrado del perfil no respondió 2xx').toBeLessThan(300);
          // 4. VERIFICAR.
          const final = await profiles(page);
          expect((final.profiles ?? []).map((p) => p.name), 'el perfil de prueba sigue en nsh/profiles').not.toContain(name);
        } catch (e) {
          throw new Error(`TEARDOWN FALLIDO: el perfil "${name}" puede seguir en la cuenta. Borrarlo en Profile > "${name} ändern" > Löschen.\n${String(e)}`);
        }
      } else if (created) {
        throw new Error(`El alta respondió 2xx pero "${name}" no aparece en nsh/profiles.`);
      }
    }
  });
});
