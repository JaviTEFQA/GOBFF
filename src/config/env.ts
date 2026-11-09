/**
 * src/config/env.ts — Single source of runtime configuration.
 *
 * Loads `BFF/.env`; when it does not exist, falls back to the web automation
 * project's `.env` (../ai-playwright-agent/.env) so the same O2 credentials
 * serve both projects without copying secrets around.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export const ROOT = path.resolve(__dirname, '..', '..');

const localEnv = path.join(ROOT, '.env');
const webEnv = path.resolve(ROOT, '..', 'ai-playwright-agent', '.env');
// Both are read: BFF/.env first (its values win), then the web project's .env fills what is
// missing (the O2 credentials), so settings live here and secrets are not copied around.
for (const file of [localEnv, webEnv]) if (fs.existsSync(file)) dotenv.config({ path: file });

function str(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim();
}

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const env = {
  appUrl: str('APP_URL', 'https://tv.o2online.de/').replace(/\/?$/, '/'),
  login: str('O2_LOGIN') || str('O2_USERNAME'),
  password: str('O2_PASSWORD'),
  profileName: str('O2_PROFILE_NAME') || str('O2_PROFILE'),

  canowayBaseUrl: str('CANOWAY_BASE_URL', 'https://canoway-de.cdn.telefonica.com/instance/45/service').replace(/\/$/, ''),
  appVersion: str('APP_VERSION', '26.10.100'),
  /**
   * Versión del contrato contra la que validar. Vacío = la propia (appVersion). Al llegar una
   * versión nueva, se captura con APP_VERSION=<nueva> pero se valida contra el contrato de la
   * anterior (CONTRACT_BASELINE=<anterior>): así lo PRIMERO es ver qué rompe de la versión previa.
   */
  contractBaseline: str('CONTRACT_BASELINE'),

  headless: str('HEADLESS', 'true') !== 'false',
  // Presupuesto de latencia. Los tiempos vienen del navegador (captura en vivo), que añade algo de
  // overhead sobre una llamada HTTP cruda; por eso el margen es algo mayor que un SLA de API puro.
  latencyBudgetMs: num('API_LATENCY_BUDGET_MS', 4000),
  allowMutations: str('API_ALLOW_MUTATIONS', 'false') === 'true',
  /** Las pruebas de mutación abren navegador visible por defecto (fijar selectores sin riesgo). */
  mutationsHeadless: str('MUTATIONS_HEADLESS', 'false') === 'true',
  /** Open a visible browser and let a person log in (npm run auth:manual). */
  manualAuth: str('AUTH_MANUAL', 'false') === 'true',
  /**
   * HTTP Basic credentials of the deployment server (deploy.mca.tid.es builds answer 401
   * without them). Kept out of APP_URL so no logged URL ever carries them.
   */
  httpCredentials: str('APP_BASIC_USER')
    ? { username: str('APP_BASIC_USER'), password: str('APP_BASIC_PASSWORD') }
    : undefined,
};

/**
 * Absolute URL of an app route. The app may live under a sub-path
 * (https://deploy.mca.tid.es/nightly/release/26.10.x-production-de-de/), where page.goto('/catalog')
 * would jump to the server root. Routes are always resolved against APP_URL; a link the app
 * itself rendered (already under the sub-path) is kept as is.
 */
export function appRoute(route: string): string {
  const base = new URL(env.appUrl);
  if (/^https?:/.test(route)) return route;
  if (route.startsWith(base.pathname) && base.pathname !== '/') return new URL(route, base).href;
  return new URL(route.replace(/^\//, ''), base).href;
}

export const paths = {
  authDir: path.join(ROOT, '.auth'),
  /** Replayable canoway request headers (incl. the BFF access token). */
  sessionFile: path.join(ROOT, '.auth', 'canoway-session.json'),
  /** Browser storage state of the logged-in web app, reused by ui-mocked tests. */
  storageState: path.join(ROOT, '.auth', 'storage-state.json'),
  recordings: (version = env.appVersion) => path.join(ROOT, 'recordings', version),
  contracts: (version = env.appVersion) => path.join(ROOT, 'contracts', version),
  contractOverrides: path.join(ROOT, 'contracts', 'overrides.json'),
};
