/**
 * Negocio (GO-35243): GET nsh/profiles devuelve perfiles coherentes.
 * - exactamente UN perfil por defecto (isDefaultProfile),
 * - todos traen isExitBlocked (la historia que añade el campo),
 * - cada perfil tiene id numérico, nombre no vacío y flags booleanas.
 * Valida la respuesta real capturada en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Profile {
  id?: unknown;
  name?: unknown;
  isBlocked?: unknown;
  isKids?: unknown;
  hasAccessCode?: unknown;
  isExitBlocked?: unknown;
  isDefaultProfile?: unknown;
}

const isBool = (v: unknown) => typeof v === 'boolean';

test('[MULTISTC-76632] los perfiles son coherentes: uno por defecto y todos con isExitBlocked', { tag: ['@business'] }, async () => {
  const { captured, samples } = fromLive('GET nsh/profiles');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no llamó a nsh/profiles durante el recorrido.');

  const body = samples[0]!.body as { profiles?: unknown; isProfileAddEnabled?: unknown };
  expect(Array.isArray(body?.profiles), 'profiles no es lista').toBe(true);
  const profiles = body!.profiles as Profile[];
  expect(profiles.length, 'sin perfiles').toBeGreaterThan(0);

  // Exactamente un perfil por defecto: con cero el cliente no sabe cuál abrir; con dos, parpadea.
  const defaults = profiles.filter((p) => p.isDefaultProfile === true);
  expect(defaults.length, `perfiles por defecto: ${defaults.length} (debe ser 1)`).toBe(1);

  // GO-35243: isExitBlocked presente en todos.
  const sinExit = profiles.filter((p) => !isBool(p.isExitBlocked));
  expect.soft(sinExit.map((p) => p.name), 'perfiles sin isExitBlocked booleano').toEqual([]);

  // Integridad por perfil.
  const malformed = profiles.filter(
    (p) => typeof p.id !== 'number' || typeof p.name !== 'string' || p.name.trim() === '' || !isBool(p.isKids) || !isBool(p.hasAccessCode) || !isBool(p.isBlocked),
  );
  expect.soft(malformed.map((p) => JSON.stringify(p).slice(0, 100)), 'perfiles con id/nombre/flags inválidos').toEqual([]);
});
