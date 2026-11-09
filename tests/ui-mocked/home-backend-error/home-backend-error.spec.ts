import { expect, test } from '../../../src/testing/fixtures';
import { goToApp } from '../../../src/recordings/journeys';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

/** Home de la web 26.10: la pide con GET nsh/thematic-site-page-prio (ya no nsh/home). */
const HOME = 'GET nsh/thematic-site-page-prio';

for (const status of [500, 503]) {
  test(`[MULTISTC-76665] home survives ${HOME} ${status}`, { tag: ['@ui-mocked', '@resilience'] }, async ({ page, canowayMock, pageErrors }) => {
    const mock = await canowayMock({ rules: [rules.error(HOME, status)] });

    await goToApp(page, '/');
    await expect(page.locator(ui.appShell).first(), 'app shell must still render').toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(3000);

    expect(mock.callsTo(HOME).some((c) => c.status === status), `the web did not receive the mocked ${status}`).toBe(true);
    expect(pageErrors.map(String), 'uncaught JS errors (white screen risk)').toEqual([]);
  });
}
