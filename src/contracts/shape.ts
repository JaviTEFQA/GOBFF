/**
 * src/contracts/shape.ts — Infer a structural contract from real responses and validate against it.
 *
 * The contract is inferred from every recorded sample of an endpoint, so it
 * only demands what the API really guarantees:
 *   - a field is `required` only when it appeared in EVERY sample/element seen;
 *   - a field may hold several types (e.g. string | null) when samples differ;
 *   - fields the API adds later are reported as `added` (warning), never as failure;
 *   - objects keyed by ids (maps) are collapsed into one value schema so they
 *     do not explode into thousands of "required" keys.
 *
 * Failures (`missing`, `type`) are exactly what breaks a consumer: a field
 * that disappeared or changed type.
 */

export type JsonType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object';

export interface Shape {
  types: JsonType[];
  properties?: Record<string, Shape>;
  required?: string[];
  /** Object used as a dictionary (keys are ids): every value follows this shape. */
  mapValues?: Shape;
  items?: Shape;
}

export interface Violation {
  path: string;
  kind: 'missing' | 'type' | 'added';
  expected?: string;
  actual?: string;
}

const MAX_ARRAY_ITEMS = 300;
const MAP_KEY_RE = /^([A-Z]{2,5}\d{3,}|\d+|[0-9a-f-]{16,})$/i;

export function jsonType(v: unknown): JsonType {
  if (v === null || v === undefined) return 'null';
  if (Array.isArray(v)) return 'array';
  const t = typeof v;
  if (t === 'boolean' || t === 'number' || t === 'string') return t;
  return 'object';
}

function looksLikeMap(obj: Record<string, unknown>): boolean {
  const keys = Object.keys(obj);
  return keys.length >= 3 && keys.every((k) => MAP_KEY_RE.test(k));
}

export function infer(value: unknown): Shape {
  const t = jsonType(value);
  if (t === 'array') {
    const arr = (value as unknown[]).slice(0, MAX_ARRAY_ITEMS);
    const items = arr.length ? arr.map(infer).reduce(merge) : undefined;
    return items ? { types: ['array'], items } : { types: ['array'] };
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (looksLikeMap(obj)) {
      return { types: ['object'], mapValues: Object.values(obj).map(infer).reduce(merge) };
    }
    const properties: Record<string, Shape> = {};
    for (const [k, v] of Object.entries(obj)) properties[k] = infer(v);
    return { types: ['object'], properties, required: Object.keys(obj).sort() };
  }
  return { types: [t] };
}

function union<T>(a: T[] = [], b: T[] = []): T[] {
  return [...new Set([...a, ...b])].sort() as T[];
}

/** Merge two shapes: the result accepts everything either accepted. */
export function merge(a: Shape, b: Shape): Shape {
  const out: Shape = { types: union(a.types, b.types) };

  const aObj = a.types.includes('object');
  const bObj = b.types.includes('object');
  if (a.mapValues || b.mapValues) {
    const values = [a.mapValues, b.mapValues, ...Object.values(a.properties ?? {}), ...Object.values(b.properties ?? {})]
      .filter(Boolean) as Shape[];
    out.mapValues = values.reduce(merge);
  } else if (aObj || bObj) {
    const keys = union(Object.keys(a.properties ?? {}), Object.keys(b.properties ?? {}));
    out.properties = {};
    for (const k of keys) {
      const pa = a.properties?.[k];
      const pb = b.properties?.[k];
      out.properties[k] = pa && pb ? merge(pa, pb) : (pa ?? pb)!;
    }
    // Only one side was an object (other was e.g. null): the object side's requirements stand.
    out.required = aObj && bObj ? (a.required ?? []).filter((k) => (b.required ?? []).includes(k)) : (aObj ? a.required : b.required) ?? [];
  }

  if (a.items || b.items) out.items = a.items && b.items ? merge(a.items, b.items) : (a.items ?? b.items);
  return out;
}

export function inferFromSamples(samples: unknown[]): Shape | null {
  return samples.length ? samples.map(infer).reduce(merge) : null;
}

function isOptional(path: string, optional: string[]): boolean {
  return optional.some((p) => p === path || (p.endsWith('*') && path.startsWith(p.slice(0, -1))));
}

/**
 * Validate a value against a contract.
 * @param optional JSON paths (e.g. "$.home[].contents[].triangles", or prefix "$.debug*")
 *   declared optional in contracts/overrides.json — absent is fine, type still checked.
 */
export function validate(value: unknown, shape: Shape, optional: string[] = [], path = '$'): Violation[] {
  const t = jsonType(value);
  if (!shape.types.includes(t)) {
    // Integers/floats are both "number"; the only allowed loosening is null for an optional path.
    if (!(t === 'null' && isOptional(path, optional))) {
      return [{ path, kind: 'type', expected: shape.types.join('|'), actual: t }];
    }
    return [];
  }
  const out: Violation[] = [];
  if (t === 'array' && shape.items) {
    (value as unknown[]).slice(0, MAX_ARRAY_ITEMS).forEach((item) => {
      out.push(...validate(item, shape.items!, optional, `${path}[]`));
    });
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (shape.mapValues) {
      for (const v of Object.values(obj)) out.push(...validate(v, shape.mapValues, optional, `${path}{}`));
    } else if (shape.properties) {
      for (const k of shape.required ?? []) {
        const p = `${path}.${k}`;
        if (!(k in obj) && !isOptional(p, optional)) out.push({ path: p, kind: 'missing', expected: shape.properties[k]?.types.join('|') });
      }
      for (const [k, v] of Object.entries(obj)) {
        const p = `${path}.${k}`;
        const sub = shape.properties[k];
        if (sub) out.push(...validate(v, sub, optional, p));
        else out.push({ path: p, kind: 'added', actual: jsonType(v) });
      }
    }
  }
  return dedupe(out);
}

/** Same violation repeated across array elements → report once. */
function dedupe(vs: Violation[]): Violation[] {
  const seen = new Set<string>();
  return vs.filter((v) => {
    const k = `${v.kind}|${v.path}|${v.expected}|${v.actual}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export interface ShapeDiff {
  removed: string[];
  added: string[];
  typeChanged: Array<{ path: string; from: string; to: string }>;
  becameOptional: string[];
}

/** Structural diff between two contracts (e.g. 26.10.100 → 26.11.100). */
export function diffShapes(from: Shape, to: Shape, path = '$', acc: ShapeDiff = { removed: [], added: [], typeChanged: [], becameOptional: [] }): ShapeDiff {
  const ft = from.types.join('|');
  const tt = to.types.join('|');
  if (ft !== tt) acc.typeChanged.push({ path, from: ft, to: tt });
  if (from.items && to.items) diffShapes(from.items, to.items, `${path}[]`, acc);
  if (from.mapValues && to.mapValues) diffShapes(from.mapValues, to.mapValues, `${path}{}`, acc);
  const fp = from.properties ?? {};
  const tp = to.properties ?? {};
  for (const k of Object.keys(fp)) {
    const p = `${path}.${k}`;
    if (!(k in tp)) acc.removed.push(p);
    else {
      if ((from.required ?? []).includes(k) && !(to.required ?? []).includes(k)) acc.becameOptional.push(p);
      diffShapes(fp[k]!, tp[k]!, p, acc);
    }
  }
  for (const k of Object.keys(tp)) if (!(k in fp)) acc.added.push(`${path}.${k}`);
  return acc;
}
