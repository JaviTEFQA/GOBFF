import { defineConfig, devices } from '@playwright/test';
import { env, paths } from './src/config/env';

/**
 * Projects
 *   unit       framework self-tests (offline, no credentials)        npm run test:unit
 *   auth       harvest/refresh the canoway session                    (dependency of the rest)
 *   record     walk the web app and record canoway                    npm run record
 *   api        contract + business tests against the real canoway     npm run test:api
 *   ui-mocked  web app regression with canoway served from recordings npm run test:ui-mocked
 */
const browser = {
  ...devices['Desktop Chrome'],
  viewport: { width: 1600, height: 900 },
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  baseURL: env.appUrl,
  httpCredentials: env.httpCredentials,
  headless: env.headless,
  storageState: paths.storageState,
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 4 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    trace: 'retain-on-failure',
    // No action may wait forever (an unbounded hover behind a modal hung the session harvest).
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    { name: 'auth', testDir: './tests/setup', testMatch: /auth\.setup\.ts/ },
    // Captura en vivo: abre un navegador logado y guarda las respuestas reales del BFF para que las
    // pruebas de API las validen (canoway firma cada petición y no se pueden reenviar a mano).
    { name: 'live-capture', testDir: './tests/setup', testMatch: /live-capture\.setup\.ts/, dependencies: ['auth'], timeout: 900_000, use: browser },
    {
      name: 'record',
      testDir: './tests/record',
      dependencies: ['auth'],
      fullyParallel: false,
      timeout: 180_000,
      use: browser,
    },
    // Pruebas por componente (perfiles, home, grabaciones…), en tests/<componente>/<tipo>.
    // `api` corre contrato + negocio + seguridad (todo menos @mutation).
    {
      name: 'api',
      testDir: './tests',
      testIgnore: ['unit/**', 'setup/**', 'ui-mocked/**', 'record/**'],
      grepInvert: /@mutation/,
      dependencies: ['auth', 'live-capture'],
      timeout: 90_000,
    },
    // Mutaciones (escritura real del BFF): apagadas salvo API_ALLOW_MUTATIONS=true. En serie y con
    // navegador visible por defecto; cada prueba deshace lo que hizo (hacer → verificar → deshacer).
    {
      name: 'mutations',
      testDir: './tests',
      testIgnore: ['unit/**', 'setup/**', 'ui-mocked/**', 'record/**'],
      grep: /@mutation/,
      dependencies: ['auth'],
      fullyParallel: false,
      timeout: 180_000,
      use: { ...browser, headless: env.mutationsHeadless },
    },
    { name: 'ui-mocked', testDir: './tests/ui-mocked', dependencies: ['auth'], timeout: 90_000, use: browser },
  ],
});
