/**
 * Negocio: la home del BFF 26.10 (GET nsh/thematic-site-page-prio) devuelve secciones usables.
 * Valida la respuesta REAL capturada en vivo (la app firma cada petición; ver live-capture.ts).
 */
import { expect, test } from '../../../src/testing/fixtures';
import { loadLiveCapture, liveSamples } from '../../../src/testing/live-capture';

const HOME = 'GET nsh/thematic-site-page-prio';

interface Content {
  pid?: unknown;
  title?: unknown;
}
interface Section {
  type?: unknown;
  contents?: unknown;
}

const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';
const brief = (v: unknown) => JSON.stringify(v).slice(0, 120);

test('[MULTISTC-76648] la home devuelve secciones con contenidos usables', { tag: ['@business', '@smoke'] }, async () => {
  const capture = loadLiveCapture();
  test.skip(!capture, 'No hay captura en vivo: ejecuta "npm run test:api".');
  const sample = liveSamples(capture, HOME)[0];
  test.skip(!sample, `La web no llamó a ${HOME} durante el recorrido (journey "home").`);

  expect(sample!.status, `${HOME} → ${sample!.status}`).toBe(200);
  const body = sample!.body as { thematicSite?: unknown };
  expect(Array.isArray(body?.thematicSite), `"thematicSite" no es lista: ${brief(body?.thematicSite)}`).toBe(true);
  const sections = body!.thematicSite as Section[];
  expect(sections.length, 'home sin secciones').toBeGreaterThan(0);

  // Soft: se comprueban todas y se informa; una sección rota no oculta a las demás.
  const untyped = sections.filter((s) => !nonEmpty(s?.type));
  expect.soft(untyped.map(brief), 'secciones sin "type"').toEqual([]);

  const badContents = sections.filter((s) => s?.contents !== undefined && !Array.isArray(s.contents));
  expect.soft(badContents.map(brief), 'secciones cuyo "contents" no es lista').toEqual([]);

  const contents = sections.flatMap((s) => (Array.isArray(s?.contents) ? (s.contents as Content[]) : []));
  expect(contents.length, 'ninguna sección tiene contenidos').toBeGreaterThan(0);

  // Las tarjetas de contenido necesitan pid Y título. Las de tipo enlace (LNK…) son accesos de
  // navegación con imagen y sin título: es correcto que no lo tengan, así que se excluyen.
  const isLink = (c: Content) => typeof c?.pid === 'string' && c.pid.startsWith('LNK');
  const cards = contents.filter((c) => !isLink(c));
  expect(cards.length, 'la home solo trae enlaces, ninguna tarjeta de contenido').toBeGreaterThan(0);

  // Strings, no solo "truthy": un pid numérico o un título vacío también rompen la tarjeta.
  const broken = cards.filter((c) => !nonEmpty(c?.pid) || !nonEmpty(c?.title));
  expect.soft(broken.slice(0, 10).map(brief), `${broken.length} tarjetas de contenido sin pid/título (no se pueden pintar ni abrir)`).toEqual([]);
});
