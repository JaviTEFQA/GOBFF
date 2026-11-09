/**
 * Mutación: cambiar el PIN de Jugendschutz (control parental) y dejar el original.
 * Patrón hacer → verificar → deshacer, moviendo la UI (la app firma las llamadas):
 *   1. Ajustes > PINs & Jugendschutz > "PIN ändern": PIN original → PIN temporal.
 *      La app llama a `ValidatePin` (pin actual) y `ChangePin` (`blender/service3.0/UserService.svc`, pinType=1).
 *   2. VERIFICA que el temporal es el PIN vigente: al restaurar, `ValidatePin` lo acepta.
 *   3. DESHACE: PIN temporal → PIN original.
 *   4. VERIFICA que el original vuelve a valer: la petición de PIN de "Profil hinzufügen" (`CheckPin`)
 *      lo acepta; se sale antes de elegir avatar, sin crear ningún perfil.
 * Si no se puede restaurar, la prueba falla y avisa: la cuenta quedaría con el PIN temporal.
 * PIN original: PARENTAL_PIN en .env (nunca en el código). Los PIN no se escriben en logs ni anotaciones.
 */
import type { Page } from '@playwright/test';
import { expect, test } from '../../../src/testing/fixtures';
import { env } from '../../../src/config/env';
import { goToApp, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, type CanowayHit } from '../../../src/testing/mutation';

const ORIGINAL = process.env.PARENTAL_PIN ?? '';
const TEMP = process.env.PARENTAL_PIN_TEMP ?? '2580';
const CHANGE = /UserService\.svc\/ChangePin$/;
const VALIDATE = /UserService\.svc\/ValidatePin$/;
/** La petición de PIN de "Profil hinzufügen" usa CheckPin. */
const CHECK = /UserService\.svc\/CheckPin$/;
const accepted = (h: CanowayHit) => h.status < 300 && (h.json as { Content?: unknown } | null)?.Content === true;

/** Cambia el PIN por la UI y devuelve las llamadas ValidatePin y ChangePin que hace la app. */
async function changePin(page: Page, from: string, to: string): Promise<{ validate: CanowayHit; change: CanowayHit | null }> {
  await goToApp(page, '/settings?pid=SET317');
  await settle(page, 2500);
  await page.getByRole('button', { name: 'PIN ändern' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[name="currentCode"]').fill(from);
  await dialog.locator('input[name="newCode"]').fill(to);
  await dialog.locator('input[name="confirm"]').fill(to);
  let change: CanowayHit | null = null;
  const changed = page
    .waitForResponse((r) => CHANGE.test(new URL(r.url()).pathname) && r.request().method() === 'GET', { timeout: 20_000 })
    .then(async (r) => (change = { url: r.url(), method: 'GET', status: r.status(), json: await r.json().catch(() => null) }))
    .catch(() => null);
  const validate = await awaitCanoway(page, { method: 'GET', pathRe: VALIDATE, trigger: () => dialog.getByRole('button', { name: 'Ok' }).click() });
  if (accepted(validate)) await changed;
  await settle(page, 1500);
  if (await dialog.isVisible().catch(() => false)) await page.keyboard.press('Escape');
  return { validate, change };
}

test.describe('[MULTISTC-76700] control parental: cambiar el PIN y restaurarlo', { tag: ['@mutation', '@pin'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');
  test.skip(!/^\d{4}$/.test(ORIGINAL), 'Falta PARENTAL_PIN (Jugendschutz-PIN de la cuenta) en .env.');

  test('cambia el PIN de Jugendschutz a uno temporal y deja el original', async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    // 1. HACER.
    const first = await changePin(page, ORIGINAL, TEMP);
    testInfo.annotations.push({ type: 'cambio', description: `ValidatePin → ${first.validate.status} ${String(accepted(first.validate))} · ChangePin → ${first.change?.status ?? '—'}` });
    expect(accepted(first.validate), 'el PIN original (PARENTAL_PIN) no es válido: revisar el PIN de la cuenta').toBe(true);
    const changed = !!first.change && accepted(first.change);

    try {
      expect(changed, 'ChangePin no confirmó el cambio (Content=true)').toBe(true);
    } finally {
      // 2 + 3. VERIFICAR el temporal y DESHACER (aunque el cambio no se confirmara: puede haberse aplicado).
      const back = await changePin(page, TEMP, ORIGINAL);
      testInfo.annotations.push({ type: 'restaurar', description: `ValidatePin → ${back.validate.status} ${String(accepted(back.validate))} · ChangePin → ${back.change?.status ?? '—'}` });
      if (changed) {
        expect(accepted(back.validate), 'el PIN temporal no es válido tras el cambio').toBe(true);
        if (!back.change || !accepted(back.change)) {
          throw new Error('TEARDOWN FALLIDO: la cuenta puede haber quedado con el PIN temporal (PARENTAL_PIN_TEMP). Restaurarlo en Ajustes > PINs & Jugendschutz > PIN ändern.');
        }
      }

      // 4. VERIFICAR que el original vuelve a valer (petición de PIN al añadir perfil; se cierra sin crear nada).
      await goToApp(page, '/profiles/list');
      await settle(page, 2000);
      await page.getByRole('button', { name: 'Profil hinzufügen' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('input[name="code"]').fill(ORIGINAL);
      const check = await awaitCanoway(page, { method: 'GET', pathRe: CHECK, trigger: () => dialog.getByRole('button', { name: 'Ok' }).click() });
      testInfo.annotations.push({ type: 'comprobación final', description: `CheckPin(original) → ${check.status} ${String(accepted(check))}` });
      // Tras el PIN la web pasa a elegir avatar: se sale sin crear el perfil.
      await goToApp(page, '/');
      expect(accepted(check), 'TEARDOWN FALLIDO: el PIN original no vuelve a ser válido').toBe(true);
    }
  });
});
