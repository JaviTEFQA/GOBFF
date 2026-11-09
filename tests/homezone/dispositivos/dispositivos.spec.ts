/**
 * Negocio (GO-36090 · Concurrency Control & HomeZone: ClientZone). `GET nsh/devices` (Ajustes >
 * Geräte verwalten) devuelve STB y OTT con todos sus campos (MULTISTC-60861), trunca la lista OTT
 * al máximo configurado sin perder el total (60862) y calcula los botones por dispositivo
 * (`isStopVisible`, `isDeleteVisible`: 60863, 60864). Solo lectura: no se para ni borra nada.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

interface Device {
  deviceId?: unknown;
  deviceType?: unknown;
  deviceName?: unknown;
  isActive?: unknown;
  lastModified?: unknown;
  buttons?: { isStopVisible?: unknown; isDeleteVisible?: unknown };
}

test('[MULTISTC-76685] la ClientZone lista STB y OTT bien formados, truncados y con sus botones', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/devices');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no abrió Ajustes > Geräte verwalten.');
  const body = samples[0]!.body as { total?: unknown; stb?: Device[]; ott?: Device[] };

  expect(Array.isArray(body.stb), 'stb es una lista').toBe(true);
  expect(Array.isArray(body.ott), 'ott es una lista').toBe(true);
  expect(typeof body.total, 'total numérico').toBe('number');
  const shown = body.stb!.length + body.ott!.length;
  testInfo.annotations.push({ type: 'dispositivos', description: `total ${String(body.total)} · mostrados STB ${body.stb!.length} + OTT ${body.ott!.length}` });
  // 60862: la lista OTT se trunca, pero el total sigue contando todos.
  expect.soft(body.total as number, 'total menor que los dispositivos mostrados').toBeGreaterThanOrEqual(shown);

  for (const d of [...body.stb!, ...body.ott!]) {
    const id = String(d.deviceId);
    expect.soft(typeof d.deviceId === 'string' && d.deviceId !== '', `${id}: deviceId`).toBe(true);
    expect.soft(typeof d.deviceType, `${id}: deviceType`).toBe('number');
    expect.soft(typeof d.deviceName, `${id}: deviceName`).toBe('string');
    expect.soft(typeof d.isActive, `${id}: isActive`).toBe('boolean');
    expect.soft(typeof d.lastModified, `${id}: lastModified`).toBe('number');
    expect.soft(typeof d.buttons?.isStopVisible, `${id}: buttons.isStopVisible`).toBe('boolean');
    expect.soft(typeof d.buttons?.isDeleteVisible, `${id}: buttons.isDeleteVisible`).toBe('boolean');
    // 60863: no se puede "parar" la sesión de un dispositivo que no está reproduciendo.
    if (d.isActive === false) expect.soft(d.buttons?.isStopVisible, `${id}: parar visible en un dispositivo inactivo`).toBe(false);
  }
  const ids = body.ott!.map((d) => d.deviceId);
  expect.soft(ids.length, 'deviceId repetidos en OTT').toBe(new Set(ids).size);
});
