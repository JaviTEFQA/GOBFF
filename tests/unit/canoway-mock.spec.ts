/**
 * Offline end-to-end check of the mock engine in a real browser: cross-origin
 * fetch to canoway from an app-like origin, recordings served with dates
 * shifted, rules, fallbacks and unmatched reporting.
 */
import * as fs from 'fs';
import { expect, test } from '@playwright/test';
import { paths } from '../../src/config/env';
import { mockCanoway, rules } from '../../src/mocks/canoway-mock';
import { buildExchange, saveExchange } from '../../src/recordings/store';

const BASE = 'https://canoway-de.cdn.telefonica.com/instance/45/service';
const APP = 'https://tv.o2online.de/__unit';
const RECORDED_AT = Date.now() - 10 * 86_400_000; // recorded 10 days ago
// One private recordings folder per worker: parallel workers never touch each other's files.
let VERSION = '';

test.beforeAll(({}, workerInfo) => {
  VERSION = `__unit_mock_${workerInfo.workerIndex}_${process.pid}__`;
  const ex = (url: string, body: unknown) => {
    const e = buildExchange({ journey: 'unit', method: 'GET', url, requestHeaders: { authorization: 'Bearer eyJa.eyJb.c' }, status: 200, responseHeaders: {}, responseText: JSON.stringify(body) });
    e.recordedAt = new Date(RECORDED_AT).toISOString();
    saveExchange(e, VERSION);
  };
  ex(`${BASE}/nsh/home`, { home: [{ type: 'live', contents: [{ pid: 'EPI1000', title: 'Tagesschau', startTime: RECORDED_AT - 600_000, endTime: RECORDED_AT + 600_000 }] }] });
  ex(`${BASE}/nsh/unified-detailed-content/MOV1111`, { pid: 'MOV1111', title: 'Film' });
});

test.afterAll(() => fs.rmSync(paths.recordings(VERSION), { recursive: true, force: true }));

test.beforeEach(async ({ page }) => {
  await page.route(APP, (r) => r.fulfill({ contentType: 'text/html', body: '<html><body>app</body></html>' }));
  await page.goto(APP);
});

const call = (page: import('@playwright/test').Page, url: string) =>
  page.evaluate(async (u) => {
    const r = await fetch(u, { headers: { authorization: 'Bearer x' } });
    return { status: r.status, body: await r.text() };
  }, url);

test('serves the recording with dates rebased to now (live stays on air)', async ({ page }) => {
  const mock = await mockCanoway(page, { version: VERSION, unmatched: 'block' });
  const res = await call(page, `${BASE}/nsh/home`);
  expect(res.status).toBe(200);
  const c = JSON.parse(res.body).home[0].contents[0];
  expect(c.startTime).toBeLessThan(Date.now());
  expect(c.endTime).toBeGreaterThan(Date.now());
  expect(mock.callsTo('GET nsh/home')[0]!.servedBy).toBe('recording');
});

test('other PID of a recorded endpoint falls back to a recording of that endpoint', async ({ page }) => {
  const mock = await mockCanoway(page, { version: VERSION, unmatched: 'block' });
  const res = await call(page, `${BASE}/nsh/unified-detailed-content/MOV9999`);
  expect(JSON.parse(res.body).title).toBe('Film');
  expect(mock.calls[0]!.servedBy).toBe('recording-fallback');
});

test('rules: patch, error, 509 once then recording', async ({ page }) => {
  await mockCanoway(page, {
    version: VERSION,
    unmatched: 'block',
    rules: [
      rules.orchestrator509('GET nsh/unified-detailed-content/{pid}', 1),
      rules.patch('GET nsh/home', (b) => ({ ...b, patched: true })),
    ],
  });
  expect(JSON.parse((await call(page, `${BASE}/nsh/home`)).body).patched).toBe(true);
  expect((await call(page, `${BASE}/nsh/unified-detailed-content/MOV1111`)).status).toBe(509);
  expect((await call(page, `${BASE}/nsh/unified-detailed-content/MOV1111`)).status).toBe(200);
});

test('unmatched calls are reported (block policy)', async ({ page }) => {
  // 'block' guarantees no test of this file can ever reach the real canoway.
  const mock = await mockCanoway(page, { version: VERSION, unmatched: 'block' });
  expect((await call(page, `${BASE}/nsh/recordings`)).status).toBe(503);
  expect(() => mock.expectNoUnmatched()).toThrow(/GET nsh\/recordings/);
});

test('secrets never reach the recording files', () => {
  const dir = paths.recordings(VERSION);
  const all = fs.readdirSync(dir, { recursive: true }).map(String).filter((f) => f.endsWith('.json'));
  for (const f of all) expect(fs.readFileSync(`${dir}/${f}`, 'utf8')).not.toMatch(/Bearer|eyJa/);
});

test('tokens in response bodies are redacted before writing', () => {
  const ex = buildExchange({
    journey: 'unit',
    method: 'GET',
    url: 'https://canoway-de.cdn.telefonica.com/instance/45/service/users/switchProfile?profileid=30',
    requestHeaders: {},
    status: 200,
    responseHeaders: {},
    responseText: JSON.stringify({
      access_token: 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln',
      refresh_token: 'opaque-refresh',
      expires_in: 3600,
      drm: { cToken: 'abc', licenseServer: 'https://lic' },
      note: 'see eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.c2ln here',
    }),
  });
  const body = ex.response.body as Record<string, any>;
  expect(body.access_token).toBe('<redacted>');
  expect(body.refresh_token).toBe('<redacted>');
  expect(body.expires_in).toBe(3600);
  expect(body.drm.cToken).toBe('<redacted>');
  expect(body.drm.licenseServer).toBe('https://lic');
  expect(body.note).toBe('see <jwt> here');
});
