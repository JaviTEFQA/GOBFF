/**
 * Negocio: GET nsh/menu devuelve un menú navegable.
 * El menú superior trae entradas con pid y título, flags booleanas, y ninguna entrada superior
 * abre una ventana nueva (la navegación principal es interna). Valida la respuesta real en vivo.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface MenuItem {
  pid?: unknown;
  titleInMenu?: unknown;
  opensNewWindow?: unknown;
  requiresPin?: unknown;
}

const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const isBool = (v: unknown) => typeof v === 'boolean';

test('[MULTISTC-76654] el menú es navegable y bien formado', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/menu');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no llamó a nsh/menu durante el recorrido.');

  const menu = (samples[0]!.body as { menu?: Record<string, unknown> }).menu ?? {};
  expect(Array.isArray(menu.topMenu), 'topMenu no es lista').toBe(true);
  const top = menu.topMenu as MenuItem[];
  expect(top.length, 'topMenu vacío').toBeGreaterThan(0);

  testInfo.annotations.push({ type: 'topMenu', description: top.map((m) => String(m.titleInMenu)).join(' | ') });

  // Cada entrada necesita pid (destino) y título (etiqueta), y flags booleanas donde vengan.
  const malformed = top.filter((m) => !nonEmpty(m.pid) || !nonEmpty(m.titleInMenu) || (m.opensNewWindow !== undefined && !isBool(m.opensNewWindow)) || (m.requiresPin !== undefined && !isBool(m.requiresPin)));
  expect.soft(malformed.map((m) => JSON.stringify(m).slice(0, 100)), 'entradas de topMenu sin pid/título o con flags no booleanas').toEqual([]);

  // La navegación principal es interna: ninguna entrada superior debe abrir ventana nueva.
  const external = top.filter((m) => m.opensNewWindow === true);
  expect.soft(external.map((m) => m.titleInMenu), 'entradas de topMenu que abren ventana nueva').toEqual([]);

  // Las secciones del menú existen (aunque alguna pueda venir vacía según el perfil).
  for (const key of ['profileMenu', 'minimalBottomMenu', 'supportMenu']) {
    expect.soft(menu[key] !== undefined, `falta la sección "${key}" del menú`).toBe(true);
  }
});
