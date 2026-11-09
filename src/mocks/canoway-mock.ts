/**
 * src/mocks/canoway-mock.ts — Serve recorded canoway responses to the web app.
 *
 *   const mock = await mockCanoway(page, {
 *     rules: [rules.patch('GET nsh/home', (b) => { b.home[0].contents[0].title = 'QA'; return b; })],
 *   });
 *   await page.goto('/');
 *   mock.expectNoUnmatched();
 *
 * Every canoway request of the page is resolved in this order:
 *   1. the first MockRule that matches (endpoint id or URL regex), if any;
 *   2. the recording with the same request key (path + query, dates ignored);
 *   3. any recording of the same endpoint id (another PID, another page);
 *   4. the `unmatched` policy: 'passthrough' (real backend), 'block' (503) or 'fail' (404).
 *
 * Recorded bodies are date-shifted to "now" before serving (see date-shift.ts),
 * so a recording made weeks ago still shows programmes on air, rentals valid, etc.
 *
 * The mock is installed on one page/context and dies with it: tests never
 * share mock state.
 */
import type { BrowserContext, Page, Route, Request } from '@playwright/test';
import { endpointId, isCanowayUrl, requestKey, SESSION_ENDPOINTS } from '../catalog/endpoint-id';
import { env } from '../config/env';
import { loadExchanges, type RecordedExchange } from '../recordings/store';
import { shiftDates, type DateShiftMode } from './date-shift';

export interface MockRule {
  /** Endpoint id ("GET nsh/home", "* nsh/home" for any method) or a regex on the full URL. */
  endpoint: string | RegExp;
  status?: number;
  /** Literal body to serve instead of the recording. */
  body?: unknown;
  /** Receives the (date-shifted, deep-copied) recorded body; returns the body to serve. */
  transform?: (body: any, recorded: RecordedExchange | null) => unknown;
  delayMs?: number;
  /** Simulate a network failure (connection refused, DNS…). */
  abort?: boolean;
  /** Apply this rule only N times, then fall through to the next rule/recording. */
  times?: number;
  headers?: Record<string, string>;
}

export interface MockOptions {
  version?: string;
  dateShift?: DateShiftMode;
  unmatched?: 'passthrough' | 'block' | 'fail';
  rules?: MockRule[];
}

export interface MockedCall {
  endpointId: string;
  url: string;
  servedBy: 'rule' | 'recording' | 'recording-fallback' | 'passthrough' | 'unmatched';
  status?: number;
}

export interface MockController {
  readonly calls: MockedCall[];
  readonly unmatched: MockedCall[];
  callsTo(endpoint: string): MockedCall[];
  /** Throws listing the canoway calls that had no recording (to know what to re-record). */
  expectNoUnmatched(): void;
  dispose(): Promise<void>;
}

// ── recording index (cached per version) ─────────────────────────────────────

interface Index {
  byKey: Map<string, RecordedExchange>;
  byEndpoint: Map<string, RecordedExchange[]>;
}
const indexCache = new Map<string, Index>();

function index(version: string): Index {
  let idx = indexCache.get(version);
  if (!idx) {
    idx = { byKey: new Map(), byEndpoint: new Map() };
    for (const ex of loadExchanges(version)) {
      if (ex.response.status >= 400) continue; // never replay a recorded failure by accident
      idx.byKey.set(ex.key, ex);
      idx.byEndpoint.set(ex.endpointId, [...(idx.byEndpoint.get(ex.endpointId) ?? []), ex]);
    }
    // An empty index is never cached: recordings written later in the run must be picked up.
    if (idx.byKey.size) indexCache.set(version, idx);
  }
  return idx;
}

function ruleMatches(rule: MockRule, id: string, url: string): boolean {
  if (rule.endpoint instanceof RegExp) return rule.endpoint.test(url);
  if (rule.endpoint.startsWith('* ')) return id.slice(id.indexOf(' ') + 1) === rule.endpoint.slice(2);
  return rule.endpoint === id;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers()['origin'] ?? new URL(env.appUrl).origin;
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-expose-headers': '*',
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function mockCanoway(target: Page | BrowserContext, opts: MockOptions = {}): Promise<MockController> {
  const version = opts.version ?? env.appVersion;
  const mode = opts.dateShift ?? 'exact';
  const unmatchedPolicy = opts.unmatched ?? 'passthrough';
  const rules = (opts.rules ?? []).map((r) => ({ ...r, left: r.times ?? Infinity }));
  const idx = index(version);
  const calls: MockedCall[] = [];

  const handler = async (route: Route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(req) });
      return;
    }

    const id = endpointId(method, url);
    const rule = rules.find((r) => r.left > 0 && ruleMatches(r, id, url));
    if (rule) rule.left--;

    // Session endpoints are recorded with their tokens redacted: serving them would hand the
    // app a fake token, so they always go to the real backend unless a rule says otherwise.
    const isSessionEndpoint = SESSION_ENDPOINTS.has(id);
    const exact = isSessionEndpoint ? undefined : idx.byKey.get(requestKey(method, url));
    const recorded = isSessionEndpoint ? null : exact ?? idx.byEndpoint.get(id)?.[0] ?? null;

    if (rule?.delayMs) await sleep(rule.delayMs);
    if (rule?.abort) {
      calls.push({ endpointId: id, url, servedBy: 'rule' });
      await route.abort('connectionrefused');
      return;
    }

    const hasRuleOutput = rule && (rule.body !== undefined || rule.status !== undefined || rule.transform);
    if (!recorded && !hasRuleOutput) {
      if (unmatchedPolicy === 'passthrough') {
        calls.push({ endpointId: id, url, servedBy: 'passthrough' });
        await route.fallback();
        return;
      }
      const status = unmatchedPolicy === 'block' ? 503 : 404;
      calls.push({ endpointId: id, url, servedBy: 'unmatched', status });
      await route.fulfill({ status, headers: corsHeaders(req), body: '' });
      return;
    }

    let body: unknown =
      rule?.body !== undefined
        ? rule.body
        : recorded
          ? shiftDates(structuredClone(recorded.response.body), { mode, recordedAt: recorded.recordedAt })
          : {};
    if (rule?.transform) body = rule.transform(body, recorded);

    const status = rule?.status ?? recorded?.response.status ?? 200;
    const servedBy: MockedCall['servedBy'] = rule ? 'rule' : exact ? 'recording' : 'recording-fallback';
    calls.push({ endpointId: id, url, servedBy, status });

    const isText = typeof body === 'string';
    await route.fulfill({
      status,
      headers: {
        ...corsHeaders(req),
        'content-type': isText && !recorded?.response.isJson ? 'text/plain' : 'application/json',
        'cache-control': 'no-store',
        ...(rule?.headers ?? {}),
      },
      body: isText ? (body as string) : JSON.stringify(body),
    });
  };

  const matcher = (u: URL) => isCanowayUrl(u.toString());
  await target.route(matcher, handler);

  const unmatched = () => calls.filter((c) => c.servedBy === 'passthrough' || c.servedBy === 'unmatched');
  return {
    calls,
    get unmatched() {
      return unmatched();
    },
    callsTo: (endpoint) => calls.filter((c) => c.endpointId === endpoint),
    expectNoUnmatched() {
      const missing = [...new Set(unmatched().map((c) => c.endpointId))];
      if (missing.length) {
        throw new Error(
          `canoway calls without recording (version ${version}). Re-record with "npm run record":\n  - ${missing.join('\n  - ')}`,
        );
      }
    },
    dispose: () => target.unroute(matcher, handler),
  };
}

// ── rule presets ─────────────────────────────────────────────────────────────

/** Deep copy where every array is emptied (empty rails, no channels, no recordings…). */
export function emptyArrays(v: unknown): unknown {
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, emptyArrays(x)]));
  return v;
}

export const rules = {
  /** Backend error on one endpoint (500, 502, 503, 401…). */
  error: (endpoint: MockRule['endpoint'], status = 500, body: unknown = { error: 'mocked' }): MockRule => ({ endpoint, status, body }),
  /** Orchestrator overload (509) for the first `times` calls, then the recording. */
  orchestrator509: (endpoint: MockRule['endpoint'], times = 1): MockRule => ({ endpoint, status: 509, body: {}, times }),
  /** Recorded response but every list empty. */
  empty: (endpoint: MockRule['endpoint']): MockRule => ({ endpoint, transform: (b) => emptyArrays(b) }),
  /** Recorded response delivered late. */
  slow: (endpoint: MockRule['endpoint'], delayMs: number): MockRule => ({ endpoint, delayMs, transform: (b) => b }),
  /** Network failure. */
  offline: (endpoint: MockRule['endpoint']): MockRule => ({ endpoint, abort: true }),
  /** Modify the recorded (date-shifted) body. */
  patch: (endpoint: MockRule['endpoint'], fn: (body: any) => unknown): MockRule => ({ endpoint, transform: fn }),
  /** Fully custom body. */
  body: (endpoint: MockRule['endpoint'], body: unknown, status = 200): MockRule => ({ endpoint, body, status }),
};
