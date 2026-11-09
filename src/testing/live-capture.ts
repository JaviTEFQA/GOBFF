/**
 * src/testing/live-capture.ts — Capturas en vivo del BFF a través de la web logada.
 *
 * Por qué existe: canoway firma CADA petición (`authorization: OP Bearer=<jwt>, Signature=<sig>`)
 * con una firma distinta por llamada, calculada por el cliente HTTP interno de la app (código
 * ofuscado). Una cabecera capturada solo vale para su URL exacta y caduca en segundos, así que no
 * se pueden reenviar peticiones a mano (dan 401). La única forma de obtener respuestas reales es
 * dejar que la propia app las pida.
 *
 * Qué hace: abre UN navegador logado (reusa la sesión guardada, sin volver a hacer login para no
 * bloquear el SSO), recorre las journeys y guarda cada respuesta 2xx de canoway en
 *   .live/<versión>/capture.json   (efímero, en .gitignore).
 * Las pruebas de contrato y de negocio leen de ahí y validan contra el esquema guardado.
 *
 * Los cuerpos se pasan por redactBody por si quedara algún token (cToken de DRM, etc.): conserva
 * los tipos, así que el contrato se sigue validando igual.
 */
import * as fs from 'fs';
import * as path from 'path';
import { chromium } from '@playwright/test';
import { endpointId, isCanowayUrl, requestKey, requestShape } from '../catalog/endpoint-id';
import { env, paths, ROOT } from '../config/env';
import { selectProfileIfAsked } from '../auth/o2-login';
import { JOURNEYS } from '../recordings/journeys';
import { redactBody } from '../recordings/store';

export interface LiveSample {
  key: string;
  shape: string;
  url: string;
  method: string;
  status: number;
  isJson: boolean;
  body: unknown;
  durationMs?: number;
  journey: string;
  /** Momento (epoch ms) en que llegó la respuesta: el "ahora" de las reglas que dependen del tiempo. */
  at?: number;
}

export interface LiveCapture {
  version: string;
  appUrl: string;
  capturedAt: string;
  journeys: string[];
  endpoints: Record<string, LiveSample[]>;
  /** Respuestas de error (4xx/5xx) de canoway: las provoca a propósito alguna journey (p. ej. un pid inexistente). */
  errors?: LiveSample[];
  /** Respuestas de otros servicios que las reglas del BFF necesitan como referencia (p. ej. la ContentAPI). */
  extras?: Record<string, { url: string; at: number; body: unknown }>;
}

/** Clave en `extras` del árbol de CHAs de la ContentAPI (`contents/all?contentTypes=CHA`). */
export const EXTRA_CONTENTAPI_CHA = 'contentapi:CHA';
const CONTENTAPI_CHA_RE = /contentapi[^/]*\/.*\/contents\/all\?.*contentTypes=CHA/i;

/**
 * Fichero de la captura. `LIVE_CAPTURE_FILE` lo sustituye por otro (p. ej. una captura sintética de
 * `npm run synthetic`): sirve para comprobar las reglas de negocio con datos que la cuenta no tiene.
 */
export function liveCaptureFile(version = env.appVersion): string {
  const override = process.env.LIVE_CAPTURE_FILE;
  if (override) return path.isAbsolute(override) ? override : path.join(ROOT, override);
  return path.join(ROOT, '.live', version, 'capture.json');
}

export function loadLiveCapture(version = env.appVersion): LiveCapture | null {
  const file = liveCaptureFile(version);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as LiveCapture;
  } catch {
    return null;
  }
}

/** Samples capturados en vivo para un endpoint, variados por "shape" (tipo de contenido / query). */
export function liveSamples(capture: LiveCapture | null, id: string): LiveSample[] {
  return capture?.endpoints[id] ?? [];
}

/**
 * Atajo para pruebas de negocio: carga la captura y devuelve sus samples de un endpoint.
 * Úsalo con `test.skip(!r.captured, …)` (no hay captura) y `test.skip(!r.samples.length, …)`
 * (la app no llamó al endpoint).
 */
export function fromLive(id: string, version?: string): { captured: boolean; samples: LiveSample[] } {
  const capture = loadLiveCapture(version);
  return { captured: !!capture, samples: liveSamples(capture, id) };
}

function addSample(cap: LiveCapture, s: LiveSample): void {
  const list = (cap.endpoints[endpointId(s.method, s.url)] ??= []);
  // Un sample por shape: dos películas no aportan; una película y una serie sí. En las fichas, uno por
  // shape y journey: la película de alquiler (detail-movie) y la contratable (detail-subscribable) cubren reglas distintas.
  const perJourney = /unified-detailed/.test(s.shape);
  if (list.some((e) => e.shape === s.shape && (!perJourney || e.journey === s.journey))) return;
  list.push(s);
}

/**
 * Recorre la app logada y captura las respuestas de canoway. Un fallo de una journey no aborta la
 * captura (se anota y se sigue): es preferible una captura parcial a ninguna.
 */
export async function captureLive(): Promise<LiveCapture> {
  const capture: LiveCapture = {
    version: env.appVersion,
    appUrl: env.appUrl,
    capturedAt: new Date().toISOString(),
    journeys: [],
    endpoints: {},
    errors: [],
    extras: {},
  };
  const browser = await chromium.launch({ headless: env.headless });
  try {
    const context = await browser.newContext({
      httpCredentials: env.httpCredentials,
      storageState: fs.existsSync(paths.storageState) ? paths.storageState : undefined,
      locale: 'de-DE',
      timezoneId: 'Europe/Berlin',
      viewport: { width: 1600, height: 900 },
      baseURL: env.appUrl,
    });
    const page = await context.newPage();

    // La journey en curso: etiqueta cada sample con la pantalla que lo provocó (para los READMEs).
    let current = 'bootstrap';

    // Capturar en toda la sesión: la firma va atada a la URL, así que basta con leer la respuesta
    // que la app ya recibió (no reenviamos nada).
    page.on('requestfinished', async (req) => {
      if (req.method() === 'OPTIONS') return;
      // ContentAPI (árbol de CHAs con ca_requiresPin): referencia para las reglas de PIN de adultos.
      if (CONTENTAPI_CHA_RE.test(req.url())) {
        try {
          const res = await req.response();
          if (res && res.status() < 400 && !capture.extras![EXTRA_CONTENTAPI_CHA]) {
            capture.extras![EXTRA_CONTENTAPI_CHA] = { url: req.url(), at: Date.now(), body: JSON.parse(await res.text()) };
          }
        } catch {
          /* se ignora */
        }
        return;
      }
      if (!isCanowayUrl(req.url())) return;
      try {
        const res = await req.response();
        if (!res) return;
        if (res.status() >= 400) {
          let errBody: unknown = null;
          try {
            errBody = redactBody(JSON.parse(await res.text()));
          } catch {
            /* sin cuerpo JSON */
          }
          capture.errors!.push({
            key: requestKey(req.method(), req.url()),
            shape: requestShape(requestKey(req.method(), req.url())),
            url: req.url(),
            method: req.method().toUpperCase(),
            status: res.status(),
            isJson: errBody !== null,
            body: errBody,
            journey: current,
            at: Date.now(),
          });
          return;
        }
        const text = await res.text();
        let body: unknown = text;
        let isJson = false;
        try {
          body = redactBody(JSON.parse(text));
          isJson = true;
        } catch {
          /* texto */
        }
        const timing = req.timing();
        addSample(capture, {
          key: requestKey(req.method(), req.url()),
          shape: requestShape(requestKey(req.method(), req.url())),
          url: req.url(),
          method: req.method().toUpperCase(),
          status: res.status(),
          isJson,
          body,
          durationMs: timing.responseEnd > 0 ? Math.round(timing.responseEnd) : undefined,
          journey: current,
          at: Date.now(),
        });
      } catch {
        /* cuerpo evacuado o redirección: se ignora */
      }
    });

    // Arranque: abre la app y elige el perfil; luego cada journey navega dentro de la misma sesión.
    await page.goto(env.appUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForURL((u) => /\/profiles\/list/.test(u.pathname), { timeout: 8000, waitUntil: 'commit' }).catch(() => {});
    await selectProfileIfAsked(page, env.profileName);
    await page.waitForTimeout(3000);

    // "player" reproduce vídeo 15 s y no añade endpoints nuevos (playback/information ya se captura
    // al abrir la ficha): se omite para que la captura sea más rápida y estable.
    const SKIP = new Set((process.env.LIVE_CAPTURE_SKIP ?? 'player').split(',').map((s) => s.trim()).filter(Boolean));
    // Presupuesto total: el setup tiene 900 s. Si se agota, se guarda lo capturado hasta ahí en vez
    // de perderlo todo por timeout (las pruebas de los endpoints no capturados lo indicarán).
    const budgetMs = Number(process.env.LIVE_CAPTURE_BUDGET_S ?? 780) * 1000;
    const started = Date.now();
    for (const journey of JOURNEYS) {
      if (SKIP.has(journey.name)) continue;
      if (Date.now() - started > budgetMs) {
        console.warn(`[live] presupuesto de ${budgetMs / 1000}s agotado: se omiten las journeys restantes desde "${journey.name}".`);
        break;
      }
      current = journey.name;
      const t0 = Date.now();
      try {
        await journey.run(page);
        await page.waitForTimeout(800);
        capture.journeys.push(journey.name);
      } catch (e) {
        console.warn(`[live] journey "${journey.name}" falló (se continúa): ${String(e).split('\n')[0]}`);
      }
      console.log(`[live] ${journey.name}: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }

    const file = liveCaptureFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(capture, null, 2));
    const total = Object.values(capture.endpoints).reduce((n, l) => n + l.length, 0);
    console.log(`[live] ${env.appVersion}: ${total} samples en ${Object.keys(capture.endpoints).length} endpoints → ${path.relative(ROOT, file)}`);
    return capture;
  } finally {
    await browser.close();
  }
}

/** Respuestas de error capturadas de un endpoint (las provocan journeys como `detail-invalid`). */
export function liveErrors(id: string, version?: string): { captured: boolean; errors: LiveSample[] } {
  const capture = loadLiveCapture(version);
  return { captured: !!capture, errors: (capture?.errors ?? []).filter((e) => endpointId(e.method, e.url) === id) };
}

/** Respuesta de referencia de otro servicio guardada junto a la captura (p. ej. EXTRA_CONTENTAPI_CHA). */
export function liveExtra(key: string, version?: string): { captured: boolean; body: unknown | null } {
  const capture = loadLiveCapture(version);
  return { captured: !!capture, body: capture?.extras?.[key]?.body ?? null };
}
