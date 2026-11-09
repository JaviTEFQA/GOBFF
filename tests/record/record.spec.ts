/**
 * tests/record/record.spec.ts — Record every canoway exchange of the web app.
 *
 *   APP_VERSION=26.10.100 npm run record
 *
 * Walks each journey of src/recordings/journeys.ts with the logged-in session
 * and saves request/response pairs to recordings/<APP_VERSION>/. At the end it
 * rewrites inventory.json and the inferred contracts of that version.
 * Re-run it to refresh data (new PIDs, new EPG) or when a version ships.
 */
import * as fs from 'fs';
import * as path from 'path';
import { test } from '@playwright/test';
import { isCanowayUrl } from '../../src/catalog/endpoint-id';
import { env, paths } from '../../src/config/env';
import { buildContracts } from '../../src/contracts/registry';
import { JOURNEYS } from '../../src/recordings/journeys';
import { buildExchange, loadExchanges, saveExchange, writeInventory } from '../../src/recordings/store';

test.describe.configure({ mode: 'serial' });

for (const journey of JOURNEYS) {
  test(`record ${journey.name}`, async ({ page }) => {
    let saved = 0;
    const skipped: string[] = [];
    page.on('requestfinished', async (req) => {
      if (!isCanowayUrl(req.url()) || req.method() === 'OPTIONS') return;
      try {
        const res = await req.response();
        if (!res) return;
        const timing = req.timing();
        saveExchange(
          buildExchange({
            journey: journey.name,
            method: req.method(),
            url: req.url(),
            requestHeaders: await req.allHeaders(),
            requestBody: req.postData(),
            status: res.status(),
            responseHeaders: await res.allHeaders(),
            responseText: await res.text(),
            durationMs: timing.responseEnd > 0 ? Math.round(timing.responseEnd) : undefined,
          }),
        );
        saved++;
      } catch (e) {
        // Body evicted / redirect: skipped, but never silently — a silent skip hid that
        // whole journeys were not being recorded.
        skipped.push(`${req.method()} ${new URL(req.url()).pathname.replace(/.*\/service\//, '')}: ${String(e).split('\n')[0]}`);
      }
    });

    await journey.run(page);
    await page.waitForTimeout(1000);
    test.info().annotations.push({ type: 'recorded', description: `${saved} canoway exchanges` });
    if (skipped.length) {
      test.info().annotations.push({ type: 'not-recorded', description: skipped.join(' | ') });
      console.warn(`[record] ${journey.name}: ${skipped.length} canoway call(s) not recorded:\n  ${skipped.join('\n  ')}`);
    }
    console.log(`[record] ${journey.name}: ${saved} saved`);
  });
}

test.afterAll(() => {
  const exchanges = loadExchanges();
  const inventory = writeInventory(exchanges);
  buildContracts(exchanges);
  fs.writeFileSync(
    path.join(paths.recordings(), 'meta.json'),
    JSON.stringify({ appVersion: env.appVersion, appUrl: env.appUrl, recordedAt: new Date().toISOString(), endpoints: inventory.length, exchanges: exchanges.length }, null, 2),
  );
  console.log(`\n[record] ${env.appVersion}: ${exchanges.length} exchanges, ${inventory.length} endpoints → recordings/${env.appVersion}`);
  console.log('[record] next: npm run scaffold   (creates a test + README for every new endpoint)');
});
