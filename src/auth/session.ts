/**
 * src/auth/session.ts — Obtain replayable canoway credentials from the real web app.
 *
 * canoway is called with a BFF access token (JWT) the web app gets after the
 * O2 SSO login. Rather than re-implement the token exchange (fragile, and it
 * changes between versions), the harvest:
 *   1. opens the web app (reusing the saved browser storage state if any),
 *   2. logs in only when the app is anonymous,
 *   3. takes the headers of the first authenticated canoway request,
 *   4. saves them to .auth/canoway-session.json and the browser state to
 *      .auth/storage-state.json (reused by the ui-mocked tests).
 *
 * The session is reused while the JWT is valid (2-minute margin) and
 * re-harvested automatically when it expires or canoway answers 401/403.
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Request } from '@playwright/test';
import { env, paths, ROOT } from '../config/env';
import { isCanowayUrl } from '../catalog/endpoint-id';
import { needsLogin, o2DeLogin, selectProfileIfAsked, SSO_RE } from './o2-login';

export interface CanowaySession {
  headers: Record<string, string>;
  authHeaderName: string | null;
  expiresAt: number | null;
  capturedAt: number;
}

const DROP_HEADERS = /^(host|content-length|content-type|connection|accept-encoding|if-none-match|if-modified-since|sec-fetch-.*|sec-ch-.*|:.*)$/i;
const JWT_RE = /eyJ[\w-]+\.([\w-]+)\.[\w-]+/;
const MARGIN_MS = 2 * 60_000;
const FALLBACK_TTL_MS = 30 * 60_000;

export function jwtExpiry(value: string): number | null {
  const m = value.match(JWT_RE);
  if (!m) return null;
  try {
    const payload = JSON.parse(Buffer.from(m[1]!, 'base64url').toString('utf8')) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function authHeaderOf(headers: Record<string, string>): string | null {
  const entries = Object.entries(headers);
  return (
    entries.find(([k, v]) => k.toLowerCase() === 'authorization' && v.length > 20)?.[0] ??
    entries.find(([, v]) => JWT_RE.test(v))?.[0] ??
    null
  );
}

export function isValid(s: CanowaySession | null): s is CanowaySession {
  if (!s) return false;
  const exp = s.expiresAt ?? s.capturedAt + FALLBACK_TTL_MS;
  return Date.now() < exp - MARGIN_MS;
}

export function loadSession(): CanowaySession | null {
  if (!fs.existsSync(paths.sessionFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(paths.sessionFile, 'utf8')) as CanowaySession;
  } catch {
    return null;
  }
}

/**
 * Keeps the headers of the LATEST authenticated canoway request. The first one is not good
 * enough: choosing a profile calls users/switchProfile, which issues a new token and makes the
 * earlier one answer 401. `latest()` is read once the app has settled on the chosen profile.
 */
function trackAuthenticated(onRequest: (cb: (r: Request) => void) => void): { latest: () => Record<string, string> | null; count: () => number } {
  let last: Record<string, string> | null = null;
  let n = 0;
  onRequest(async (req) => {
    if (!isCanowayUrl(req.url()) || req.method() === 'OPTIONS') return;
    if (/\/users\/switchProfile/.test(req.url())) return; // carries the pre-switch token
    const headers = await req.allHeaders().catch(() => ({} as Record<string, string>));
    const name = authHeaderOf(headers);
    if (!name) return;
    const exp = jwtExpiry(headers[name]!);
    if (exp !== null && exp < Date.now()) return;
    last = headers;
    n++;
  });
  return { latest: () => last, count: () => n };
}

export async function harvestSession(): Promise<CanowaySession> {
  fs.mkdirSync(paths.authDir, { recursive: true });
  const browser = await chromium.launch({ headless: env.headless && !env.manualAuth });
  try {
    const context = await browser.newContext({
      httpCredentials: env.httpCredentials,
      storageState: fs.existsSync(paths.storageState) ? paths.storageState : undefined,
      locale: 'de-DE',
      viewport: { width: 1600, height: 900 },
    });
    let page = await context.newPage();
    await page.goto(env.appUrl, { waitUntil: 'domcontentloaded' });

    if (env.manualAuth && (await needsLogin(page))) {
      // Manual mode: a person logs in in the visible browser (SSO lock-out, captcha, new consent…).
      // The page starts ON the app host (anonymous), so "being on the app" proves nothing.
      // The unambiguous signal of a successful login is the SSO handing the user back to the
      // app: a request to <app>/auth/oidc. It is watched on the whole context (any tab or popup),
      // without touching the UI the person is using, and without waiting for "load" events.
      console.log('[session] MANUAL LOGIN: log in in the opened browser window (up to 5 min)…');
      const appHost = new URL(env.appUrl).hostname;
      const back = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 300_000);
        context.on('request', (r) => {
          const u = new URL(r.url());
          if (SSO_RE.test(u.href)) return;
          if (u.hostname === appHost && /\/auth\/oidc/.test(u.pathname)) {
            clearTimeout(timer);
            resolve(true);
          }
        });
        browser.on('disconnected', () => resolve(false));
      });
      if (!back) throw new Error('Manual login: the O2 SSO never handed back to the app (window closed or 5 min passed).');
      console.log('[session] SSO returned to the app; waiting for it to settle (pick a profile if asked)…');
      // Continue on the tab that holds the app (the login may have happened in another one).
      page = context.pages().find((p) => !p.isClosed() && new URL(p.url()).hostname === appHost) ?? page;
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline && /\/(auth|profiles)\b/.test(new URL(page.url()).pathname)) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      await new Promise((r) => setTimeout(r, 4000));
    } else if (await needsLogin(page)) {
      console.log('[session] anonymous → logging in through O2 SSO');
      try {
        await o2DeLogin(page, env.login, env.password, env.appUrl);
      } catch (e) {
        // The harvest browser is not traced by Playwright: keep evidence of what the SSO showed.
        const dir = path.join(ROOT, 'test-results', 'auth-failure');
        fs.mkdirSync(dir, { recursive: true });
        await page.screenshot({ path: path.join(dir, 'page.png'), fullPage: true }).catch(() => {});
        fs.writeFileSync(path.join(dir, 'page.html'), await page.content().catch(() => ''));
        throw new Error(`O2 SSO login failed at ${page.url()} (evidence: test-results/auth-failure/)\n${String(e)}`);
      }
      await selectProfileIfAsked(page, env.profileName);
    }

    // Capture on a fresh navigation, after login, so the token is the user's one.
    const listeners: Array<(r: Request) => void> = [];
    page.on('request', (r) => listeners.forEach((l) => l(r)));
    const tracker = trackAuthenticated((cb) => listeners.push(cb));
    await page.goto(env.appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => /\/profiles\/list/.test(u.pathname), { timeout: 8000, waitUntil: 'commit' }).catch(() => {});
    await selectProfileIfAsked(page, env.profileName);
    // Let the app load the home with the chosen profile, so the last token is the post-switch one.
    const settleUntil = Date.now() + 45_000;
    let seen = -1;
    while (Date.now() < settleUntil) {
      await page.waitForTimeout(3000);
      if (tracker.count() > 0 && tracker.count() === seen) break; // no new canoway calls for 3 s
      seen = tracker.count();
    }
    const headers = tracker.latest();
    if (!headers) throw new Error('No authenticated canoway request seen in 45s. Check credentials / APP_URL.');
    // Guard: the anonymous web also sends an authorization header. Never save an anonymous session
    // as if it were the user's: every test would silently run as a guest.
    if (await needsLogin(page)) {
      const dir = path.join(ROOT, 'test-results', 'auth-failure');
      fs.mkdirSync(dir, { recursive: true });
      await page.screenshot({ path: path.join(dir, 'still-anonymous.png') }).catch(() => {});
      await context.storageState({ path: path.join(dir, 'still-anonymous-state.json') }).catch(() => {});
      throw new Error(`The web app is still anonymous after login (${page.url()}): refusing to save a guest session. Evidence: test-results/auth-failure/still-anonymous.png`);
    }

    const clean = Object.fromEntries(Object.entries(headers).filter(([k]) => !DROP_HEADERS.test(k)));
    const authHeaderName = authHeaderOf(clean);
    const session: CanowaySession = {
      headers: clean,
      authHeaderName,
      expiresAt: authHeaderName ? jwtExpiry(clean[authHeaderName]!) : null,
      capturedAt: Date.now(),
    };
    await context.storageState({ path: paths.storageState });
    fs.writeFileSync(paths.sessionFile, JSON.stringify(session, null, 2));
    console.log(`[session] captured (${authHeaderName ?? 'no auth header'}) valid until ${session.expiresAt ? new Date(session.expiresAt).toISOString() : '~30 min'}`);
    return session;
  } finally {
    await browser.close();
  }
}

/** Valid session from disk, or a fresh harvest. Serialised so parallel workers harvest once. */
let inflight: Promise<CanowaySession> | null = null;
/**
 * A forced refresh (after a 401/403) happens at most once per FORCE_COOLDOWN_MS per process:
 * if canoway keeps rejecting a freshly captured session, harvesting again on every request
 * does not fix it, and each harvest may be an O2 SSO login (the SSO locks the account after
 * several in a row).
 */
const FORCE_COOLDOWN_MS = 10 * 60_000;
let lastForcedAt = 0;
export async function getSession(opts: { forceRefresh?: boolean } = {}): Promise<CanowaySession> {
  const cached = loadSession();
  if (opts.forceRefresh && Date.now() - lastForcedAt < FORCE_COOLDOWN_MS && cached) return cached;
  if (!opts.forceRefresh && isValid(cached)) return cached;
  if (opts.forceRefresh) lastForcedAt = Date.now();
  inflight ??= harvestSession().finally(() => (inflight = null));
  return inflight;
}
