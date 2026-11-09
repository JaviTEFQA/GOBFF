/**
 * src/testing/fixtures.ts — Test fixtures. Import `test`/`expect` from here, never from @playwright/test.
 *
 * Independence by construction:
 *   - `canoway`     a NEW HTTP context per test (no cookies/state carried between tests);
 *   - `canowayMock` installs mocks on THIS test's page only, removed at teardown;
 *   - `pageErrors`  uncaught JS errors of this test's page;
 * The only shared thing is the read-only session (token), refreshed automatically.
 *
 * Jira context (auto fixture): the README.md next to the spec is attached to
 * the report, its Jira key becomes an annotation, and the canoway calls made
 * by the test are attached as JSON evidence.
 */
import * as path from 'path';
import { test as base, expect } from '@playwright/test';
import { CanowayClient } from '../client/canoway-client';
import { mockCanoway, type MockController, type MockOptions } from '../mocks/canoway-mock';
import { readReadme } from './readme';

interface Fixtures {
  canoway: CanowayClient;
  canowayMock: (opts?: MockOptions) => Promise<MockController>;
  pageErrors: Error[];
  _jiraContext: void;
}

export const test = base.extend<Fixtures>({
  canoway: async ({ playwright }, use, testInfo) => {
    const api = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    const client = new CanowayClient(api);
    await use(client);
    if (client.log.length) {
      await testInfo.attach('canoway-calls.json', {
        contentType: 'application/json',
        body: JSON.stringify(
          client.log.map(({ method, url, status, durationMs, attempts }) => ({ method, url, status, durationMs, attempts })),
          null,
          2,
        ),
      });
      const retried = client.log.filter((c) => c.attempts > 1);
      if (retried.length) {
        testInfo.annotations.push({ type: 'retried-calls', description: retried.map((c) => `${c.url} (${c.attempts})`).join(', ') });
      }
    }
    await api.dispose();
  },

  canowayMock: async ({ page }, use, testInfo) => {
    const controllers: MockController[] = [];
    await use(async (opts) => {
      const c = await mockCanoway(page, opts);
      controllers.push(c);
      return c;
    });
    for (const c of controllers) {
      await testInfo.attach('canoway-mocked-calls.json', { contentType: 'application/json', body: JSON.stringify(c.calls, null, 2) });
      await c.dispose().catch(() => {});
    }
  },

  pageErrors: async ({ page }, use) => {
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await use(errors);
  },

  _jiraContext: [
    async ({}, use, testInfo) => {
      const readme = readReadme(path.dirname(testInfo.file));
      if (readme) {
        testInfo.annotations.push({ type: 'readme', description: path.relative(process.cwd(), readme.file) });
        if (readme.jira) testInfo.annotations.push({ type: 'jira', description: readme.jira });
        await testInfo.attach('README.md', { contentType: 'text/markdown', body: readme.content });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
