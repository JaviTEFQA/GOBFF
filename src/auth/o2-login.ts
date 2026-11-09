/**
 * src/auth/o2-login.ts — O2 DE ForgeRock SSO login (2 steps + optional consent).
 *
 * Same flow as ai-playwright-agent/application/o2-de/login.ts (R_26.10.100),
 * trimmed to what the token harvest needs. Keep both in sync if the SSO changes.
 */
import type { Page } from '@playwright/test';

export const SSO_RE = /login\.o2online\.de/;
const PROFILE_TRIGGER = 'button[id*="header-dropdown-trigger-"]';

async function acceptCookieBanner(page: Page): Promise<void> {
  try {
    await page.waitForSelector('#usercentrics-cmp-ui', { state: 'attached', timeout: 3000 });
    await page.evaluate(() => {
      const ui = document.querySelector('#usercentrics-cmp-ui');
      const btn =
        ui?.shadowRoot?.querySelector<HTMLElement>('button[data-testid="uc-accept-all-button"]') ??
        Array.from(ui?.shadowRoot?.querySelectorAll<HTMLElement>('button') ?? []).find((b) => /akzeptieren/i.test(b.textContent ?? ''));
      btn?.click();
    });
  } catch {
    /* no banner */
  }
  await page.addStyleTag({ content: '#usercentrics-cmp-ui{display:none!important}' }).catch(() => {});
}

/** Close app modals/overlays (Escape, then their close button) so the header is reachable. */
export async function dismissModals(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const dialog = page.locator('[role="dialog"], [class*="modal" i]:visible').first();
    if (!(await dialog.isVisible().catch(() => false))) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
    if (!(await dialog.isVisible().catch(() => false))) return;
    await dialog.locator('button[aria-label*="close" i], button[aria-label*="schlie" i], [class*="close" i]').first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
}

/** True when the app shows the anonymous state (login entry available). */
export async function needsLogin(page: Page): Promise<boolean> {
  // The profile picker ("Wähle dein Profil") has no header, but only a logged-in user reaches it.
  const onProfilePicker = () => /\/profiles\/list\b/.test(new URL(page.url()).pathname);
  const trigger = page.locator(PROFILE_TRIGGER).first();
  // Wait for the app to settle: it may still be redirecting to the profile picker.
  // (locator.isVisible() does NOT wait — its timeout option is ignored — hence this loop.)
  const deadline = Date.now() + 20_000;
  for (;;) {
    if (SSO_RE.test(page.url())) return true;
    if (onProfilePicker()) return false;
    if (await trigger.isVisible().catch(() => false)) break;
    if (Date.now() > deadline) return true;
    await page.waitForTimeout(500);
  }
  await acceptCookieBanner(page);
  if (onProfilePicker()) return false;
  // App modals (e.g. "Aufnahmespeicher voll") cover the header: close them first, and never let
  // a blocked hover wait forever (hover() without a timeout hung the whole session harvest).
  await dismissModals(page);
  await trigger.hover({ timeout: 5000 }).catch(() => {});
  const anmelden = await page.getByText('Anmelden', { exact: true }).first().waitFor({ state: 'visible', timeout: 3000 }).then(() => true, () => false);
  await page.mouse.move(0, 0).catch(() => {});
  return anmelden;
}

export async function o2DeLogin(page: Page, username: string, password: string, appUrl: string): Promise<void> {
  if (!username || !password) throw new Error('O2_LOGIN / O2_PASSWORD not set (BFF/.env or ../ai-playwright-agent/.env)');
  await acceptCookieBanner(page);

  if (!SSO_RE.test(page.url())) {
    const trigger = page.locator(PROFILE_TRIGGER).first();
    await dismissModals(page);
    await trigger.hover({ timeout: 10000 });
    await page.getByText('Anmelden', { exact: true }).first().click({ timeout: 15000 });
    await page.waitForURL(SSO_RE, { timeout: 20000 });
  }

  const user = page.getByRole('textbox').first();
  await user.waitFor({ state: 'visible', timeout: 15000 });
  await user.fill(username);
  await page.getByRole('link', { name: 'Weiter' }).click();

  // The SSO page also holds a hidden password input (class "hidden"); the real one is .input__control.
  const pass = page.locator('input[type="password"].input__control').first();
  await pass.waitFor({ state: 'visible', timeout: 15000 });
  await pass.fill(password);
  await page.getByRole('link', { name: 'Einloggen' }).click();

  const appHost = new URL(appUrl).hostname;
  await page.waitForURL((u) => u.hostname === appHost || u.hostname === 'meine-daten.o2online.de', { timeout: 45000 });

  for (let i = 0; i < 2 && page.url().includes('meine-daten.o2online.de'); i++) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    const boxes = page.getByRole('checkbox');
    for (let n = 0; n < (await boxes.count()); n++) await boxes.nth(n).check({ force: true, timeout: 3000 }).catch(() => {});
    await page.locator('button:has-text("Speichern"), input[type="submit"][value*="Speichern"]').first().click().catch(() => {});
    await page.waitForTimeout(4000);
    if (!page.url().includes(appHost)) await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
  }
}

/** After login some accounts land on the profile picker: pick the configured (or first) profile. */
export async function selectProfileIfAsked(page: Page, profileName: string): Promise<void> {
  if (!/\/profiles/.test(page.url())) return;
  // The clickable element is the avatar image (alt="<name> avatar"), not the name label under it:
  // clicking the label does nothing (same approach as ai-playwright-agent profile-selection.ts).
  const byName = profileName ? page.locator(`img[alt="${profileName} avatar" i], img[alt="${profileName}" i]`).first() : null;
  if (byName && (await byName.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) {
    await byName.click();
  } else if (profileName) {
    // Never fall back to "the first one": it may be PIN-locked and the run would hang on the PIN.
    throw new Error(`Profile "${profileName}" not found in the profile picker (O2_PROFILE_NAME).`);
  } else {
    await page.locator('[class*="profile"] button, [class*="profile"] a, [class*="avatar"]').first().click({ timeout: 10000 }).catch(() => {});
  }
  // waitUntil 'commit': the O2 web may never fire "load".
  await page.waitForURL((u) => !/\/profiles/.test(u.pathname), { timeout: 15000, waitUntil: 'commit' }).catch(() => {});
}
