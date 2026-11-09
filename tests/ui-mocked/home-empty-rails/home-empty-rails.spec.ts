import { expect, test } from '../../../src/testing/fixtures';
import { goToApp, scrollThrough } from '../../../src/recordings/journeys';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

/** Home de la web 26.10: secciones en nsh/thematic-site-page-prio y carruseles bajo demanda en POST nsh/carousel. */
const HOME = 'GET nsh/thematic-site-page-prio';

test('[MULTISTC-76666] home with every list empty does not break', { tag: ['@ui-mocked', '@resilience'] }, async ({ page, canowayMock, pageErrors }) => {
  // nsh/carousel no tiene grabación: se sirve directamente una lista vacía.
  const mock = await canowayMock({ rules: [rules.empty(HOME), rules.body('POST nsh/carousel', { carousels: [] })] });

  await goToApp(page, '/');
  await expect(page.locator(ui.appShell).first()).toBeVisible({ timeout: 30_000 });
  await scrollThrough(page, 4);

  expect(mock.callsTo(HOME).length, `the web did not call ${HOME}`).toBeGreaterThan(0);
  expect(pageErrors.map(String), 'uncaught JS errors with empty data').toEqual([]);
});
