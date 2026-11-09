/**
 * Negocio (GO-36535 · PIN para acceder a la sección de adultos): el BFF señaliza `requiresPin`
 * - en la raíz de la ficha (MULTISTC-61142), de ThematicGridPage (61149) y de ThematicSitePage (61150);
 * - por ítem en Carousel (61144), por colección hija del área temática (61146) y por CHA en el menú (61147);
 * y el valor de cada CHA coincide con `ca_requiresPin` de la ContentAPI (61148), que es la fuente.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { contentItems, nonBoolean, pidKind, tally } from '../../../src/testing/content-items';
import { EXTRA_CONTENTAPI_CHA, loadLiveCapture } from '../../../src/testing/live-capture';

const ROOTS = ['GET nsh/unified-detailed/{pid}', 'GET nsh/thematic-grid-page/{pid}', 'GET nsh/thematic-site-page/{pid}'];

test('[MULTISTC-76674] requiresPin está en raíz, ítems, colecciones y menú, y coincide con la ContentAPI', { tag: ['@business'] }, async ({}, testInfo) => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const items = contentItems(capture);
  testInfo.annotations.push({ type: 'requiresPin', description: tally(items, 'requiresPin') });
  expect.soft(nonBoolean(items, 'requiresPin'), 'requiresPin no booleano').toEqual([]);

  // 61142 / 61149 / 61150: raíz de ficha (de contenido: la de serie grabada, RSR, es un árbol de
  // grabaciones), de ThematicGridPage (objeto `thematicGrid`) y de ThematicSitePage (raíz del cuerpo).
  for (const id of ROOTS) {
    for (const s of (capture!.endpoints[id] ?? []).filter((x) => !/unified-detailed\/RSR/.test(x.shape))) {
      const root = s.body as Record<string, unknown>;
      const node = id.includes('thematic-grid') ? ((root.thematicGrid as Record<string, unknown>) ?? root) : root;
      expect.soft(typeof node.requiresPin, `${s.key}: requiresPin en la raíz`).toBe('boolean');
    }
  }

  // 61144: cada ítem de contenido de los carruseles.
  // (ítems de contenido; las tarjetas de canal LCH y de serie grabada RSR se anotan aparte)
  const carouselItems = items.filter((i) => i.endpoint === 'POST nsh/carousel' && /\.contents\[\d+\]$/.test(i.path));
  const isContent = (i: (typeof items)[number]) => ['MOV', 'EPI', 'SER', 'LSC', 'LSR', 'REC'].includes(pidKind(i.obj.pid));
  const noPinItems = carouselItems.filter((i) => isContent(i) && typeof i.obj.requiresPin !== 'boolean');
  expect.soft(noPinItems.map((i) => `${i.path} ${i.obj.pid}`).slice(0, 20), 'ítems de contenido del carrusel sin requiresPin').toEqual([]);
  const otherNoPin = carouselItems.filter((i) => !isContent(i) && typeof i.obj.requiresPin !== 'boolean');
  if (otherNoPin.length) testInfo.annotations.push({ type: 'tarjetas sin requiresPin', description: [...new Set(otherNoPin.map((i) => pidKind(i.obj.pid)))].map((k) => `${k}×${otherNoPin.filter((i) => pidKind(i.obj.pid) === k).length}`).join(', ') });

  // 61146: cada colección hija (thematicSite[]) del área temática; 61147: cada entrada de primer nivel del menú.
  const cha = items.filter(
    (i) =>
      pidKind(i.obj.pid) === 'CHA' &&
      ((i.endpoint === 'GET nsh/thematic-site-page/{pid}' && /^\$\.thematicSite\[\d+\]$/.test(i.path)) || (i.endpoint === 'GET nsh/menu' && /^\$\.menu\.\w+\[\d+\]$/.test(i.path))),
  );
  const chaNoPin = cha.filter((i) => typeof i.obj.requiresPin !== 'boolean');
  expect.soft(chaNoPin.map((i) => `${i.endpoint} ${i.path} ${i.obj.pid}`).slice(0, 20), 'colección o entrada de menú sin requiresPin').toEqual([]);
  // Informativo: CHA anidados (tiles de categoría en la home, enlaces del pie) que no traen el flag.
  const nested = items.filter((i) => pidKind(i.obj.pid) === 'CHA' && !cha.includes(i) && typeof i.obj.requiresPin !== 'boolean');
  if (nested.length) testInfo.annotations.push({ type: 'CHA anidados sin requiresPin', description: `${nested.length}: ${[...new Set(nested.map((i) => i.endpoint))].join(', ')}` });

  // 61148: el BFF debe dar el mismo valor que la ContentAPI para cada CHA.
  const ca = capture!.extras?.[EXTRA_CONTENTAPI_CHA]?.body as { Content?: { List?: { Pid: string; Attributes?: { ca_requiresPin?: string[] } }[] } } | undefined;
  const list = ca?.Content?.List ?? [];
  testInfo.annotations.push({ type: 'contentapi', description: list.length ? `${list.length} CHA, adultos: ${list.filter((c) => c.Attributes?.ca_requiresPin?.[0] === 'True').length}` : 'no capturada' });
  if (list.length) {
    const source = new Map(list.map((c) => [c.Pid, c.Attributes?.ca_requiresPin?.[0]]));
    const missingAttr = list.filter((c) => !Array.isArray(c.Attributes?.ca_requiresPin));
    expect.soft(missingAttr.map((c) => c.Pid).slice(0, 20), 'CHA de la ContentAPI sin ca_requiresPin').toEqual([]);
    const mismatch = cha.filter((i) => source.has(i.obj.pid as string) && String(i.obj.requiresPin) !== String(source.get(i.obj.pid as string)).toLowerCase());
    expect.soft(mismatch.map((i) => `${i.obj.pid}: BFF ${i.obj.requiresPin} vs ContentAPI ${source.get(i.obj.pid as string)} (${i.endpoint})`), 'requiresPin del BFF distinto de la ContentAPI').toEqual([]);
  }
});
