/**
 * src/testing/fresh-data.ts — Live ids for tests that need a content/channel id.
 *
 * Recorded PIDs expire (a film leaves the catalogue, an EPG event ends). Tests
 * never depend on another test to get an id: they ask canoway for fresh ones
 * here, inside the test itself.
 */
import type { CanowayClient } from '../client/canoway-client';

const PID_RE = /^[A-Z]{2,5}\d{3,}$/;

/** Every PID-looking string found in a JSON value, grouped by prefix (MOV, SER, EPI, CHA…). */
export function collectPids(value: unknown, acc = new Map<string, Set<string>>()): Map<string, Set<string>> {
  if (typeof value === 'string' && PID_RE.test(value)) {
    const prefix = value.match(/^[A-Z]+/)![0];
    if (!acc.has(prefix)) acc.set(prefix, new Set());
    acc.get(prefix)!.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => collectPids(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectPids(v, acc));
  return acc;
}

/**
 * Ids the user can open from the home: the `pid` of each card and the `pid` of
 * the content it wraps (`home[].contents[].pid` / `.content.pid`), in screen order,
 * without duplicates. Unlike `collectPids`, ids of images, channels or metadata
 * that the user never clicks are not picked.
 */
export function homeCardPids(home: unknown): string[] {
  const out = new Set<string>();
  const sections = (home as { home?: unknown })?.home;
  if (!Array.isArray(sections)) return [];
  for (const s of sections) {
    const contents = (s as { contents?: unknown })?.contents;
    if (!Array.isArray(contents)) continue;
    for (const c of contents as Array<{ pid?: unknown; content?: { pid?: unknown } }>) {
      for (const pid of [c?.pid, c?.content?.pid]) if (typeof pid === 'string' && PID_RE.test(pid)) out.add(pid);
    }
  }
  return [...out];
}

/** Live sources scanned for ids, in order; stops at the first that yields the prefix. */
export const FRESH_ID_SOURCES = ['nsh/thematic-site-page-prio', 'nsh/home', 'nsh/menu', 'nsh/channels/userOrder', 'nsh/recordings'];

/** Fresh PIDs from the live home (then menu, channels, recordings when the home has none of that prefix). */
export async function freshPids(canoway: CanowayClient, prefix: string): Promise<string[]> {
  const found = new Map<string, Set<string>>();
  for (const url of FRESH_ID_SOURCES) {
    const res = await canoway.get(url).catch(() => null);
    if (res?.json) collectPids(res.json, found);
    if (found.get(prefix)?.size) break;
  }
  return [...(found.get(prefix) ?? [])];
}
