import { expect, test } from '../../../src/testing/fixtures';
import { goToApp } from '../../../src/recordings/journeys';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

const MARKER = 'QA-MOCK-';
/** Home de la web 26.10: la pide con GET nsh/thematic-site-page-prio (ya no nsh/home). */
const HOME = 'GET nsh/thematic-site-page-prio';

test('[MULTISTC-76664] home renders the titles canoway sends', { tag: ['@ui-mocked', '@smoke'] }, async ({ page, canowayMock, pageErrors }) => {
  const mock = await canowayMock({
    rules: [
      rules.patch(HOME, (body) => {
        let i = 0;
        // Las tarjetas traen el título en el propio item o dentro de `content`, según la sección.
        for (const section of body?.thematicSite ?? [])
          for (const c of section.contents ?? []) {
            const card = c?.content ?? c;
            if (card && typeof card.title === 'string') card.title = `${MARKER}${++i}`;
          }
        return body;
      }),
    ],
  });

  await goToApp(page, '/');
  await expect(page.locator(ui.appShell).first()).toBeVisible({ timeout: 30_000 });
  expect(mock.callsTo(HOME).length, `the web did not call ${HOME}`).toBeGreaterThan(0);

  await expect(page.locator(ui.titleCarrying(MARKER)).first()).toBeAttached({ timeout: 20_000 });
  expect(pageErrors.map(String)).toEqual([]);
});
