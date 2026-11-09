import { expect, test } from '../../../src/testing/fixtures';
import { appRoute } from '../../../src/config/env';
import { ui } from '../../../src/ui/selectors';

test('[MULTISTC-76667] TV-Guide "Jetzt" shows on-air programmes from a recording made days ago', { tag: ['@ui-mocked', '@dates'] }, async ({ page, canowayMock }) => {
  // dateShift 'exact' (default): what was on air when recorded is on air now.
  const mock = await canowayMock({ dateShift: 'exact' });

  await page.goto(appRoute('/tv-guide/now'));
  await expect(page.locator(ui.appShell).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(ui.liveDetailLink).first(), 'no on-air programme rendered: dates not rebased?').toBeAttached({ timeout: 20_000 });

  const servedFromRecording = mock.calls.filter((c) => c.servedBy.startsWith('recording'));
  expect(servedFromRecording.length, 'nothing served from recordings').toBeGreaterThan(0);
});
