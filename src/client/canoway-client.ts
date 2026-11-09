/**
 * src/client/canoway-client.ts — HTTP client for canoway with the resilience the apps have.
 *
 *   const res = await canoway.get('nsh/home');
 *   const res = await canoway.send({ method: 'GET', url: recorded.request.url });
 *
 * - Retries what the backend itself signals as transient: 509 (orchestrator
 *   overload, the mobile app retries it too), 502/503/504 and network errors,
 *   with exponential backoff and Retry-After. A retried call is annotated, never hidden.
 * - 401/403 → re-harvest the session once and repeat.
 * - Every call is logged (method, url, status, ms, attempts) so the fixture can
 *   attach it to the report as evidence.
 */
import type { APIRequestContext } from '@playwright/test';
import { env } from '../config/env';
import { getSession, type CanowaySession } from '../auth/session';

export interface CanowayRequest {
  method?: string;
  /** Absolute URL, or path relative to CANOWAY_BASE_URL ("nsh/home"). */
  url: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Send without the session headers (security tests). */
  anonymous?: boolean;
  retries?: number;
}

export interface CanowayResponse<T = any> {
  method: string;
  url: string;
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  json: T | null;
  text: string;
  durationMs: number;
  attempts: number;
}

const TRANSIENT = new Set([502, 503, 504, 509]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class CanowayClient {
  readonly log: CanowayResponse[] = [];
  private session: CanowaySession | null = null;

  constructor(private readonly api: APIRequestContext) {}

  private resolve(url: string, query?: CanowayRequest['query']): string {
    const u = new URL(/^https?:/.test(url) ? url : `${env.canowayBaseUrl}/${url.replace(/^\//, '')}`);
    for (const [k, v] of Object.entries(query ?? {})) u.searchParams.set(k, String(v));
    // The web sends ?appVersion=<version> on every call and the BFF answers per calling version
    // (e.g. "26.10.100-CC" vs "26.06.100-RA"): without it a test would check the old behaviour.
    if (!u.searchParams.has('appVersion')) u.searchParams.set('appVersion', env.appVersion);
    return u.toString();
  }

  get<T = any>(url: string, query?: CanowayRequest['query']): Promise<CanowayResponse<T>> {
    return this.send<T>({ method: 'GET', url, query });
  }

  async send<T = any>(req: CanowayRequest): Promise<CanowayResponse<T>> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = this.resolve(req.url, req.query);
    const maxRetries = req.retries ?? 2;
    let reauthed = false;
    let attempts = 0;

    for (;;) {
      attempts++;
      if (!req.anonymous) this.session ??= await getSession();
      const headers = { ...(req.anonymous ? {} : this.session!.headers), ...(req.headers ?? {}) };
      const data =
        req.body === undefined ? undefined : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (data !== undefined && !Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
        headers['content-type'] = 'application/json';
      }

      const started = Date.now();
      let status = 0;
      let text = '';
      let resHeaders: Record<string, string> = {};
      try {
        const res = await this.api.fetch(url, { method, headers, data, timeout: 30_000, failOnStatusCode: false, maxRedirects: 3 });
        status = res.status();
        resHeaders = res.headers();
        text = await res.text();
      } catch (e) {
        if (attempts <= maxRetries) {
          await sleep(400 * 2 ** (attempts - 1));
          continue;
        }
        throw new Error(`canoway ${method} ${url} network error after ${attempts} attempts: ${String(e)}`);
      }
      const durationMs = Date.now() - started;

      if ((status === 401 || status === 403) && !req.anonymous && !reauthed) {
        reauthed = true;
        this.session = await getSession({ forceRefresh: true });
        continue;
      }
      if (TRANSIENT.has(status) && attempts <= maxRetries) {
        const retryAfter = Number(resHeaders['retry-after']);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 5000) : 400 * 2 ** (attempts - 1));
        continue;
      }

      let json: T | null = null;
      try {
        json = text ? (JSON.parse(text) as T) : null;
      } catch {
        /* not JSON */
      }
      const out: CanowayResponse<T> = { method, url, status, ok: status >= 200 && status < 300, headers: resHeaders, json, text, durationMs, attempts };
      this.log.push(out);
      return out;
    }
  }
}
