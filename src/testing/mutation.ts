/**
 * src/testing/mutation.ts — Utilidades para pruebas de MUTACIÓN del BFF (escritura) guiadas por UI.
 *
 * Por qué por UI: canoway firma cada petición y la firma la calcula el cliente HTTP interno de la
 * app (ver live-capture.ts). No se pueden lanzar escrituras a mano (401). La única forma de ejecutar
 * una mutación real es moviendo la UI y dejando que la app firme: aquí se captura la petición firmada
 * que la app emite y su respuesta.
 *
 * Patrón obligatorio: hacer → verificar → DESHACER. Si el deshacer falla, la prueba debe fallar
 * (nunca dejar basura en prod). Usa `ensureTeardown` para garantizarlo.
 *
 * Estas pruebas van en el proyecto `mutations`, apagado por defecto (API_ALLOW_MUTATIONS=true) y
 * pensado para correr con navegador visible la primera vez (fijar selectores sin riesgo).
 */
import type { Page, Response } from '@playwright/test';
import { isCanowayUrl } from '../catalog/endpoint-id';

export interface CanowayHit {
  url: string;
  method: string;
  status: number;
  json: unknown;
}

/**
 * Lanza `trigger` (p. ej. un clic) y espera la llamada canoway que la app emite como consecuencia,
 * devolviendo su respuesta. `pathRe` casa contra el pathname del servicio.
 */
export async function awaitCanoway(
  page: Page,
  opts: { method: string | RegExp; pathRe: RegExp; trigger: () => Promise<void>; timeout?: number },
): Promise<CanowayHit> {
  const methodOk = (m: string) =>
    typeof opts.method === 'string' ? m.toUpperCase() === opts.method.toUpperCase() : opts.method.test(m.toUpperCase());
  const match = (r: Response) =>
    isCanowayUrl(r.url()) &&
    methodOk(r.request().method()) &&
    opts.pathRe.test(new URL(r.url()).pathname);
  const [res] = await Promise.all([
    page.waitForResponse(match, { timeout: opts.timeout ?? 20_000 }),
    opts.trigger(),
  ]);
  return { url: res.url(), method: res.request().method(), status: res.status(), json: await res.json().catch(() => null) };
}

/**
 * Lee un endpoint tal como lo pide la app: ejecuta `navigate` (ir a la pantalla) y captura la
 * respuesta del endpoint cuyo pathname casa `pathRe`. Sirve para verificar el estado tras una
 * mutación (p. ej. que la grabación aparece en `recordings`).
 */
export async function readCanoway(
  page: Page,
  opts: { pathRe: RegExp; navigate: () => Promise<void>; method?: string | RegExp; timeout?: number },
): Promise<CanowayHit> {
  return awaitCanoway(page, { method: opts.method ?? 'GET', pathRe: opts.pathRe, trigger: opts.navigate, timeout: opts.timeout });
}

/**
 * Garantiza el teardown: ejecuta `body` y, pase lo que pase, ejecuta `undo`. Si `undo` falla,
 * relanza para que la prueba falle (deja constancia de que quedó basura que hay que limpiar a mano).
 */
export async function ensureTeardown<T>(body: () => Promise<T>, undo: () => Promise<void>): Promise<T> {
  let undone = false;
  try {
    const result = await body();
    await undo();
    undone = true;
    return result;
  } finally {
    if (!undone) {
      // El body falló: intentar deshacer igualmente. Si esto también falla, que explote (es grave).
      await undo();
    }
  }
}
