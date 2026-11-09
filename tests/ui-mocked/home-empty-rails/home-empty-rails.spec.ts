import { expect, test } from '../../../src/testing/fixtures';
import { appRoute } from '../../../src/config/env';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

test('[MULTISTC-76666] home with every list empty does not break', { tag: ['@ui-mocked', '@resilience'] }, async ({ page, canowayMock, pageErrors }) => {
  await canowayMock({ rules: [rules.empty('GET nsh/home'), rules.empty('GET nsh/carousel')] });

  await page.goto(appRoute('/'));
  await expect(page.locator(ui.appShell).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000);

  expect(pageErrors.map(String), 'uncaught JS errors with empty data').toEqual([]);
});
