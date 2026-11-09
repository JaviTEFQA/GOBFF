/**
 * src/mocks/date-shift.ts — Rebase the dates of a recorded body to "now".
 *
 * A body recorded on day D says "programme X airs 20:00–21:00 on D", "this
 * rental expires D+2", "recording made D-1"… Served as-is a week later, the
 * app sees everything in the past and tests fail for reasons that have
 * nothing to do with the app. So, at serve time, every date in the body is
 * moved by the time elapsed since it was recorded, keeping its format:
 *
 *   mode 'exact' (default) — shift by now − recordedAt. Relations with "now" are
 *                            kept: what was on air when recorded is on air now.
 *   mode 'days'            — shift by whole days. Time of day is kept (EPG grids
 *                            by hour, "tonight at 20:15" texts).
 *   mode 'none'            — serve the recording untouched.
 *
 * Recognised formats:
 *   - ISO 8601 strings, full or embedded ("2026-10-20T18:00:00+02:00", "…Z", "….123Z")
 *     → shifted, original offset/precision preserved;
 *   - date-only strings "2026-10-20" → shifted by whole days;
 *   - epoch numbers (ms 13 digits / s 10 digits, years 2000–2100), and numeric
 *     strings, ONLY under keys that name a time (start, end, date, time, expir…),
 *     so ids, durations and counters are never touched.
 */

export type DateShiftMode = 'exact' | 'days' | 'none';

export interface DateShiftOptions {
  mode?: DateShiftMode;
  /** Instant the body was recorded (ISO or epoch ms). */
  recordedAt: string | number;
  /** "Now" of the test run — injectable for deterministic tests. */
  now?: number;
  /** Extra key pattern treated as holding a date (in addition to the defaults). */
  dateKeyPattern?: RegExp;
  /** Keys never shifted (exact name match), e.g. ["releaseYear"]. */
  ignoreKeys?: string[];
}

const DAY = 86_400_000;
const MIN_MS = Date.UTC(2000, 0, 1);
const MAX_MS = Date.UTC(2100, 0, 1);

const DATE_WORDS = new Set(['start', 'end', 'begin', 'finish', 'date', 'time', 'timestamp', 'ts', 'until', 'since', 'from', 'to', 'at', 'epoch', 'utc', 'deadline', 'day']);
const DATE_PREFIXES = ['expir', 'valid', 'availab', 'publish', 'creat', 'updat', 'modif', 'broadcast', 'airing', 'aired'];

/**
 * True when a key names an instant: "startTime", "broadcast_start", "availableUntil",
 * "expiresAt"… The key is split into words (camelCase / snake / kebab) so that
 * "photo", "total" or "programId" never qualify.
 */
export function isDefaultDateKey(key: string): boolean {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_-]+/)
    .map((w) => w.toLowerCase())
    .filter(Boolean);
  return words.some((w) => DATE_WORDS.has(w) || DATE_PREFIXES.some((p) => w.startsWith(p)));
}

const ISO_RE =
  /\b(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?/g;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function computeDelta(opts: DateShiftOptions): number {
  const mode = opts.mode ?? 'exact';
  if (mode === 'none') return 0;
  const recorded = typeof opts.recordedAt === 'number' ? opts.recordedAt : Date.parse(opts.recordedAt);
  if (!Number.isFinite(recorded)) return 0;
  const delta = (opts.now ?? Date.now()) - recorded;
  return mode === 'days' ? Math.round(delta / DAY) * DAY : delta;
}

function pad(n: number, w = 2): string {
  return String(Math.abs(n)).padStart(w, '0');
}

/**
 * Shift one ISO match, re-rendering it with the same offset text and precision.
 * The wall-clock time is moved by `delta` and the offset kept verbatim: a shift
 * is a duration, so it is the same in every zone.
 */
function shiftIsoMatch(match: string, g: Array<string | undefined>, delta: number): string {
  const [, Y, Mo, D, h, mi, s, frac, tz] = g;
  const fracDigits = frac ? frac.length - 1 : 0;
  const ms = frac ? Math.round(Number(`0${frac}`) * 1000) : 0;
  const wall = Date.UTC(+Y!, +Mo! - 1, +D!, +h!, +mi!, s ? +s : 0, ms);
  if (!Number.isFinite(wall)) return match;
  const t = new Date(wall + delta);
  let out = `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  if (s !== undefined) out += `:${pad(t.getUTCSeconds())}`;
  if (frac !== undefined) out += `.${pad(t.getUTCMilliseconds(), 3).padEnd(fracDigits, '0').slice(0, fracDigits)}`;
  if (tz !== undefined) out += tz;
  return out;
}

export function shiftString(value: string, delta: number, keyIsDate: boolean): string {
  if (!delta) return value;
  const dOnly = value.match(DATE_ONLY_RE);
  if (dOnly) {
    const t = new Date(Date.UTC(+dOnly[1]!, +dOnly[2]! - 1, +dOnly[3]!) + Math.round(delta / DAY) * DAY);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  }
  if (keyIsDate && /^\d{10}(\d{3})?$/.test(value)) return String(shiftNumber(Number(value), delta));
  return value.replace(ISO_RE, (m, ...g) => shiftIsoMatch(m, ['', ...(g.slice(0, 8) as Array<string | undefined>)], delta));
}

export function shiftNumber(value: number, delta: number): number {
  if (!Number.isInteger(value)) return value;
  if (value >= MIN_MS && value <= MAX_MS) return value + delta; // epoch ms
  if (value >= MIN_MS / 1000 && value <= MAX_MS / 1000) return value + Math.round(delta / 1000); // epoch s
  return value;
}

/** Deep copy of `body` with every recognised date moved by the elapsed time. */
export function shiftDates<T>(body: T, opts: DateShiftOptions): T {
  const delta = computeDelta(opts);
  if (!delta) return body;
  const ignore = new Set(opts.ignoreKeys ?? []);
  const isDateKey = (k: string) =>
    !ignore.has(k) && (isDefaultDateKey(k) || (opts.dateKeyPattern?.test(k) ?? false));

  const walk = (v: unknown, key: string): unknown => {
    if (typeof v === 'string') return ignore.has(key) ? v : shiftString(v, delta, isDateKey(key));
    if (typeof v === 'number') return isDateKey(key) ? shiftNumber(v, delta) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, key));
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x, k);
      return out;
    }
    return v;
  };
  return walk(body, '') as T;
}

/** True when a query value is a date (so it is ignored when matching a request to a recording). */
export function isDateLike(value: string): boolean {
  if (DATE_ONLY_RE.test(value)) return true;
  if (new RegExp(ISO_RE.source).test(value)) return true;
  if (/^\d{10}(\d{3})?$/.test(value)) {
    const n = Number(value);
    return (n >= MIN_MS && n <= MAX_MS) || (n >= MIN_MS / 1000 && n <= MAX_MS / 1000);
  }
  return false;
}
