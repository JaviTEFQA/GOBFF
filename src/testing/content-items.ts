/**
 * src/testing/content-items.ts — Recorre los contenidos de la captura en vivo para las reglas de negocio.
 *
 * Las reglas de las historias (anuncios, miniaturas, marca de agua, PIN, catchup…) se aplican a
 * "cada contenido" esté donde esté: carruseles, rejillas, parrilla, ficha. En vez de que cada prueba
 * conozca la ruta de cada endpoint, aquí se recorre el cuerpo entero y se devuelve todo objeto con
 * `pid`, junto al endpoint que lo trajo y el momento en que llegó la respuesta.
 */
import { loadLiveCapture, type LiveCapture } from './live-capture';

export interface ContentItem {
  /** Endpoint que lo devolvió, p. ej. `GET channels`. */
  endpoint: string;
  /** Ruta JSON dentro de la respuesta (`$.channels[3].contents[0]`). */
  path: string;
  /** Momento (epoch s) de la respuesta: el "ahora" para las reglas temporales. */
  nowS: number;
  obj: Record<string, unknown>;
}

/** Tipo de contenido según el prefijo del pid: MOV, EPI, SER, LSC, LSR, LCH, REC, RSR, CHA, SUB… */
export function pidKind(pid: unknown): string {
  return typeof pid === 'string' ? (/^[A-Z]+/.exec(pid)?.[0] ?? '') : '';
}

export function contentItems(capture: LiveCapture | null = loadLiveCapture(), endpoints?: string[]): ContentItem[] {
  const out: ContentItem[] = [];
  if (!capture) return out;
  const fallbackS = Date.parse(capture.capturedAt) / 1000;
  for (const [endpoint, samples] of Object.entries(capture.endpoints)) {
    if (endpoints && !endpoints.includes(endpoint)) continue;
    for (const s of samples) {
      const nowS = s.at ? s.at / 1000 : fallbackS;
      const walk = (v: unknown, path: string): void => {
        if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
        else if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (typeof o.pid === 'string') out.push({ endpoint, path, nowS, obj: o });
          for (const [k, x] of Object.entries(o)) walk(x, `${path}.${k}`);
        }
      };
      walk(s.body, '$');
    }
  }
  return out;
}

/** Objetos de canal (LCH) en cualquier forma: `liveChannel`, `userChannels[]`, `includedLiveChannels`… */
export function channelObjects(items: ContentItem[]): ContentItem[] {
  return items.filter((i) => pidKind(i.obj.pid) === 'LCH');
}

/** Valores no booleanos de un flag que, si aparece, debe ser booleano. */
export function nonBoolean(items: ContentItem[], field: string): string[] {
  return items.filter((i) => field in i.obj && typeof i.obj[field] !== 'boolean').map((i) => `${i.endpoint} ${i.path}.${field}=${JSON.stringify(i.obj[field])}`);
}

/**
 * Mismo pid con valores distintos de un flag según el endpoint: el BFF debe propagar el mismo
 * valor de APIHub en todas las pantallas (si no, la etiqueta aparece en un sitio y no en otro).
 */
export function inconsistentAcrossEndpoints(items: ContentItem[], field: string): string[] {
  const byPid = new Map<string, Map<string, string>>();
  for (const i of items) {
    if (!(field in i.obj)) continue;
    const pid = i.obj.pid as string;
    const m = byPid.get(pid) ?? new Map<string, string>();
    m.set(JSON.stringify(i.obj[field]), i.endpoint);
    byPid.set(pid, m);
  }
  return [...byPid.entries()].filter(([, m]) => m.size > 1).map(([pid, m]) => `${pid}: ${[...m.entries()].map(([v, ep]) => `${v} en ${ep}`).join(' / ')}`);
}

/** Cuenta de valores de un campo (para anotar en el informe qué datos había). */
export function tally(items: ContentItem[], field: string): string {
  const c = new Map<string, number>();
  for (const i of items) if (field in i.obj) c.set(JSON.stringify(i.obj[field]), (c.get(JSON.stringify(i.obj[field])) ?? 0) + 1);
  return [...c.entries()].map(([v, n]) => `${v}×${n}`).join(', ') || 'ausente';
}

/** Lee una ruta con puntos (`bars.isPurchaseVisible`) sin romper si falta algún nivel. */
export function at(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}
