/**
 * tests/setup/auth.setup.ts — Make sure a valid canoway session exists before api / ui-mocked / record.
 * Reuses .auth/canoway-session.json while the JWT is valid; logs in through the web otherwise.
 */
import { test as setup, expect } from '@playwright/test';
import * as fs from 'fs';
import { getSession } from '../../src/auth/session';
import { paths } from '../../src/config/env';

setup('canoway session', async () => {
  setup.setTimeout(360_000);
  const session = await getSession();
  expect(session.authHeaderName, 'no auth header captured from the web app').toBeTruthy();
  expect(fs.existsSync(paths.storageState)).toBe(true);
});
