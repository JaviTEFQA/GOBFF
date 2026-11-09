import { expect, test } from '../../../src/testing/fixtures';
import { appRoute } from '../../../src/config/env';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

for (const status of [500, 503]) {
  test(`[MULTISTC-76665] home survives nsh/home ${status}`, { tag: ['@ui-mocked', '@resilience'] }, async ({ page, canowayMock, pageErrors }) => {
    const mock = await canowayMock({ rules: [rules.error('GET nsh/home', status)] });

    await page.goto(appRoute('/'));
    await expect(page.locator(ui.appShell).first(), 'app shell must still render').toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    expect(mock.callsTo('GET nsh/home').some((c) => c.status === status)).toBe(true);
    expect(pageErrors.map(String), 'uncaught JS errors (white screen risk)').toEqual([]);
  });
}
