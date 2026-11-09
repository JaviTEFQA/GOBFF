/**
 * src/recordings/store.ts — On-disk store of real canoway exchanges, per app version.
 *
 *   recordings/<version>/<endpoint-slug>/<hash>.json   one exchange (request + response)
 *   recordings/<version>/inventory.json                every endpoint the app called
 *
 * Exchanges are the single source of truth: the API tests replay their
 * requests, the contracts are inferred from their bodies, and the mocks serve
 * their responses to the web app. Secrets are stripped before writing.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { paths } from '../config/env';
import { endpointId, endpointSlug, requestKey, servicePath } from '../catalog/endpoint-id';

export interface RecordedExchange {
  endpointId: string;
  key: string;
  journey: string;
  recordedAt: string;
  request: {
    method: string;
    url: string;
    servicePath: string;
    headers: Record<string, string>;
    body?: string;
  };
  response: {
    status: number;
    headers: Record<string, string>;
    /** Parsed JSON when the body was JSON, raw text otherwise. */
    body: unknown;
    isJson: boolean;
    durationMs?: number;
  };
}

export interface InventoryEntry {
  endpointId: string;
  slug: string;
  method: string;
  samples: number;
  statuses: number[];
  journeys: string[];
  exampleUrl: string;
}

const SECRET_HEADER_RE = /^(authorization|cookie|set-cookie|x-.*token.*|x-.*auth.*|proxy-authorization)$/i;
const JWT_RE = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (k.startsWith(':')) continue;
    out[k] = SECRET_HEADER_RE.test(k) ? '<redacted>' : v.replace(JWT_RE, '<jwt>');
  }
  return out;
}

/** Body keys whose values are credentials (session tokens, DRM tokens). */
const SECRET_BODY_KEY_RE = /^(access_?token|refresh_?token|id_?token|token|ctoken|contextdata|password|secret|authorization)$/i;

/**
 * Remove credentials from a response/request body before it is written to disk:
 * values of secret-named keys become "<redacted>" (type kept as string so contracts still
 * infer "string"), and any JWT left inside other strings becomes "<jwt>".
 */
export function redactBody(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(JWT_RE, '<jwt>');
  if (Array.isArray(value)) return value.map(redactBody);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_BODY_KEY_RE.test(k) && (typeof v === 'string' || typeof v === 'number') ? (typeof v === 'string' ? '<redacted>' : 0) : redactBody(v),
      ]),
    );
  }
  return value;
}

export function buildExchange(input: {
  journey: string;
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: string | null;
  status: number;
  responseHeaders: Record<string, string>;
  responseText: string;
  durationMs?: number;
}): RecordedExchange {
  let body: unknown = input.responseText.replace(JWT_RE, "<jwt>");
  let isJson = false;
  try {
    body = redactBody(JSON.parse(input.responseText));
    isJson = true;
  } catch {
    /* keep text */
  }
  return {
    endpointId: endpointId(input.method, input.url),
    key: requestKey(input.method, input.url),
    journey: input.journey,
    recordedAt: new Date().toISOString(),
    request: {
      method: input.method.toUpperCase(),
      url: input.url,
      servicePath: servicePath(input.url),
      headers: redactHeaders(input.requestHeaders),
      ...(input.requestBody ? { body: input.requestBody.replace(JWT_RE, '<jwt>') } : {}),
    },
    response: {
      status: input.status,
      headers: redactHeaders(input.responseHeaders),
      body,
      isJson,
      durationMs: input.durationMs,
    },
  };
}

function hash(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
}

export function saveExchange(ex: RecordedExchange, version?: string): string {
  const dir = path.join(paths.recordings(version), endpointSlug(ex.endpointId));
  fs.mkdirSync(dir, { recursive: true });
  // One file per distinct request: re-recording overwrites with fresh data instead of piling up.
  const file = path.join(dir, `${hash(ex.key + (ex.request.body ?? ''))}.json`);
  fs.writeFileSync(file, JSON.stringify(ex, null, 2));
  return file;
}

export function loadExchanges(version?: string): RecordedExchange[] {
  const root = paths.recordings(version);
  if (!fs.existsSync(root)) return [];
  const out: RecordedExchange[] = [];
  for (const dir of fs.readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(root, dir.name))) {
      if (!f.endsWith('.json')) continue;
      out.push(JSON.parse(fs.readFileSync(path.join(root, dir.name, f), 'utf8')) as RecordedExchange);
    }
  }
  return out.sort((a, b) => a.endpointId.localeCompare(b.endpointId) || a.key.localeCompare(b.key));
}

export function groupByEndpoint(exchanges: RecordedExchange[]): Map<string, RecordedExchange[]> {
  const map = new Map<string, RecordedExchange[]>();
  for (const ex of exchanges) {
    const list = map.get(ex.endpointId) ?? [];
    list.push(ex);
    map.set(ex.endpointId, list);
  }
  return map;
}

export function buildInventory(exchanges: RecordedExchange[]): InventoryEntry[] {
  return [...groupByEndpoint(exchanges)].map(([id, list]) => ({
    endpointId: id,
    slug: endpointSlug(id),
    method: list[0]!.request.method,
    samples: list.length,
    statuses: [...new Set(list.map((e) => e.response.status))].sort(),
    journeys: [...new Set(list.map((e) => e.journey))].sort(),
    exampleUrl: list[0]!.request.url,
  }));
}

export function writeInventory(exchanges: RecordedExchange[], version?: string): InventoryEntry[] {
  const inv = buildInventory(exchanges);
  fs.mkdirSync(paths.recordings(version), { recursive: true });
  fs.writeFileSync(path.join(paths.recordings(version), 'inventory.json'), JSON.stringify(inv, null, 2));
  return inv;
}
