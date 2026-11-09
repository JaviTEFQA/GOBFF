import { expect, test } from '../../../src/testing/fixtures';
import { appRoute } from '../../../src/config/env';
import { rules } from '../../../src/mocks/canoway-mock';
import { ui } from '../../../src/ui/selectors';

const MARKER = 'QA-MOCK-';

test('[MULTISTC-76664] home renders the titles canoway sends', { tag: ['@ui-mocked', '@smoke'] }, async ({ page, canowayMock, pageErrors }) => {
  const mock = await canowayMock({
    rules: [
      rules.patch('GET nsh/home', (body) => {
        let i = 0;
        for (const section of body?.home ?? []) for (const c of section.contents ?? []) c.title = `${MARKER}${++i}`;
        return body;
      }),
    ],
  });

  await page.goto(appRoute('/'));
  await expect(page.locator(ui.appShell).first()).toBeVisible({ timeout: 30_000 });
  expect(mock.callsTo('GET nsh/home').length, 'the web did not call nsh/home').toBeGreaterThan(0);

  await expect(page.locator(ui.titleCarrying(MARKER)).first()).toBeAttached({ timeout: 20_000 });
  expect(pageErrors.map(String)).toEqual([]);
});
