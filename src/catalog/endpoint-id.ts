/**
 * src/catalog/endpoint-id.ts — Turn concrete canoway URLs into stable endpoint ids.
 *
 *   GET https://canoway-de.cdn.telefonica.com/instance/45/service/nsh/unified-detailed-content/MOV44943332
 *   → "GET nsh/unified-detailed-content/{pid}"
 *
 * The id groups every call to the same operation regardless of the content,
 * channel or user it targets. It names recordings, contracts and mock rules.
 */
import { isDateLike } from '../mocks/date-shift';

/** Host of any canoway service (cdn front, platform/events host, other OBs). */
export const CANOWAY_HOST_RE = /(^|\.)canoway[-.][^/]*$/i;

export function isCanowayUrl(url: string): boolean {
  try {
    return CANOWAY_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Query params whose value changes on every call and must not affect matching. */
export const VOLATILE_QUERY_PARAMS = new Set(['_', 't', 'ts', 'timestamp', 'cb', 'cachebuster', 'nocache', 'rnd', 'random']);

const SEGMENT_RULES: Array<[RegExp, string]> = [
  [/^[A-Z]{2,5}\d{3,}$/, '{pid}'], // MOV44943332, SER52943583, EPI…, CHA20288, SET…
  [/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, '{uuid}'],
  [/^[0-9a-f]{16,}$/i, '{hash}'],
  [/^\d{4,}$/, '{id}'],
  // Opaque tokens mix letters and digits; plain words like "unified-detailed-content" never qualify.
  [/^(?=.*\d)(?=.*[A-Za-z])[A-Za-z0-9_-]{24,}$/, '{token}'],
];

/** Path relative to `/instance/<n>/service/` (or the full path when the URL has another shape). */
export function servicePath(url: string): string {
  const { pathname } = new URL(url);
  const m = pathname.match(/\/instance\/[^/]+\/service\/?(.*)$/);
  return (m ? m[1]! : pathname.replace(/^\//, '')).replace(/\/$/, '');
}

export function templatePath(servicePathValue: string): string {
  return servicePathValue
    .split('/')
    .map((seg) => SEGMENT_RULES.find(([re]) => re.test(seg))?.[1] ?? seg)
    .join('/');
}

export function endpointId(method: string, url: string): string {
  return `${method.toUpperCase()} ${templatePath(servicePath(url)) || '/'}`;
}

/** Filesystem-safe folder name for an endpoint id. */
export function endpointSlug(id: string): string {
  return id
    .replace(/^(\w+) /, '$1__')
    .replace(/[{}]/g, '')
    .replace(/[/\\:*?"<>|. ]+/g, '_')
    .replace(/_+$/, '') || 'root';
}

/**
 * Stable matching key for a concrete request: method + concrete path + sorted,
 * non-volatile query. Date values (EPG windows: ?from=…&to=…) become `{date}`
 * because every run sends different ones.
 */
export function requestKey(method: string, url: string): string {
  const u = new URL(url);
  const q = [...u.searchParams.entries()]
    .filter(([k]) => !VOLATILE_QUERY_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${isDateLike(v) ? '{date}' : v}`)
    .join('&');
  return `${method.toUpperCase()} ${servicePath(url)}${q ? `?${q}` : ''}`;
}

/**
 * "Shape" de una petición: valores de query en blanco y PIDs reducidos a su tipo, de modo que
 * `unified-detailed/MOV…` y `/SER…` son shapes distintas (película vs serie) mientras que dos
 * películas son la misma. Se usa para quedarse con un sample por tipo de contenido.
 */
export function requestShape(key: string): string {
  return key.replace(/=[^&]*/g, '=').replace(/\b([A-Z]{2,5})\d{3,}\b/g, '$1');
}

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * GETs with side effects on the session: switching the active profile returns new tokens and
 * changes what every later call answers. They are recorded (contract) but never replayed by
 * contract tests nor served by mocks.
 */
export const SESSION_ENDPOINTS = new Set(['GET users/switchProfile']);
