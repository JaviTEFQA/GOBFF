/**
 * src/recordings/journeys.ts — Web app journeys walked by the recorder.
 *
 * Each journey visits one area of tv.o2online.de (routes from
 * ai-playwright-agent/application/o2-de/config.ts @ R_26.10.100) so that every
 * canoway call the app makes there is captured. The journey name is stored in
 * each recording and becomes the "Pantallas afectadas" of the generated READMEs.
 *
 * To cover a new area: add a journey here and run `npm run record`.
 */
import type { Page } from '@playwright/test';
import { appRoute, env } from '../config/env';
import { selectProfileIfAsked } from '../auth/o2-login';

export interface Journey {
  name: string;
  /** Human label used in READMEs / Jira. */
  screen: string;
  run: (page: Page) => Promise<void>;
}

export async function settle(page: Page, ms = 2500): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Scroll the whole page so lazy rails (nsh/carousel pages) are requested. */
export async function scrollThrough(page: Page, steps = 8): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(600);
  }
  await settle(page, 1000);
  await page.evaluate(() => window.scrollTo(0, 0));
}

/**
 * Go to an app route as the logged-in user. A fresh browser context starts on the
 * profile picker ("Wähle dein Profil"): pick the configured profile and go back to the route,
 * otherwise the journey would only record the picker's calls.
 */
const onPicker = (page: Page) => /\/profiles\/list/.test(new URL(page.url()).pathname);

export async function goToApp(page: Page, route: string): Promise<void> {
  const target = new URL(appRoute(route));
  // Already inside the app (profile chosen): navigate in-app, never reload — the chosen profile
  // lives in memory only and a reload sends the web back to the profile picker.
  if (new URL(page.url()).origin === target.origin && !onPicker(page) && !page.url().startsWith('about:')) {
    await spaNavigate(page, target);
    return;
  }
  await page.goto(appRoute('/'), { waitUntil: 'domcontentloaded' });
  await page.waitForURL((u) => /\/profiles\/list/.test(u.pathname), { timeout: 8000, waitUntil: 'commit' }).catch(() => {});
  if (onPicker(page)) {
    await selectProfileIfAsked(page, env.profileName);
    if (onPicker(page)) throw new Error(`Could not leave the profile picker with profile "${env.profileName}"`);
  }
  await settle(page, 1500);
  if (new URL(page.url()).pathname !== target.pathname || target.search) await spaNavigate(page, target);
}

/** Client-side navigation (history API + popstate), as a click on an in-app link does. */
async function spaNavigate(page: Page, target: URL, allowReload = true): Promise<void> {
  const path = target.pathname + target.search;
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await page.waitForTimeout(500);
  if (new URL(page.url()).pathname === target.pathname || !allowReload) return;
  // A router that ignored the synthetic popstate leaves the old view: fall back to a real load.
  // A real load forgets the in-memory profile and lands on the picker: pick it again and retry
  // the in-app navigation once (without another reload, so this can never loop).
  await page.goto(target.href, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((u) => /\/profiles\/list/.test(u.pathname), { timeout: 8000, waitUntil: 'commit' }).catch(() => {});
  if (onPicker(page)) {
    await selectProfileIfAsked(page, env.profileName);
    if (onPicker(page)) throw new Error(`Could not leave the profile picker with profile "${env.profileName}"`);
    await settle(page, 1500);
    await spaNavigate(page, target, false);
  }
}

async function visit(page: Page, path: string, scroll = true): Promise<void> {
  await goToApp(page, path);
  await settle(page);
  if (scroll) await scrollThrough(page);
}

async function openFirstDetail(page: Page, from: string, hrefPart: string): Promise<boolean> {
  await visit(page, from, false);
  const link = page.locator(`a[href*="${hrefPart}"]`).first();
  if (!(await link.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) {
    await scrollThrough(page, 4);
  }
  const href = await link.getAttribute('href', { timeout: 10000 }).catch(() => null);
  if (!href) return false;
  await goToApp(page, href);
  await settle(page, 3000);
  return true;
}

/** En "Mein TV" las tarjetas de grabación no son enlaces: se abre la primera de la fila indicada con un clic. */
async function openRecordingCard(page: Page, row: string): Promise<void> {
  await visit(page, '/my-tv', false);
  const heading = page.getByText(row, { exact: true }).first();
  if (!(await heading.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false))) return;
  const card = heading.locator('xpath=ancestor::*[.//img][1]').locator('img').first();
  await card.click({ timeout: 8000 }).catch(() => {});
  await settle(page, 3000);
}

export const JOURNEYS: Journey[] = [
  { name: 'home', screen: 'Home (carruseles, editoriales, live)', run: (p) => visit(p, '/') },
  { name: 'mediathek', screen: 'Catálogo Mediathek (SVOD)', run: (p) => visit(p, '/catalog/mediathek-14798') },
  { name: 'videothek', screen: 'Catálogo Videothek (TVOD)', run: (p) => visit(p, '/catalog/videothek-15640') },
  { name: 'streaming', screen: 'Catálogo Streaming (Crunchyroll…)', run: (p) => visit(p, '/catalog/streaming-19341') },
  { name: 'tv-guide-now', screen: 'TV-Guide · Jetzt (en emisión)', run: (p) => visit(p, '/tv-guide/now') },
  { name: 'epg', screen: 'TV-Guide · EPG (parrilla)', run: (p) => visit(p, '/tv-guide/epg', false) },
  { name: 'my-tv', screen: 'Mein TV · Grabaciones', run: (p) => visit(p, '/my-tv') },
  { name: 'favorites', screen: 'Mein TV · Favoritos', run: (p) => visit(p, '/my-tv/favorite') },
  { name: 'settings', screen: 'Ajustes', run: (p) => visit(p, '/settings', false) },
  { name: 'profiles', screen: 'Gestión de perfiles', run: (p) => visit(p, '/profiles/list', false) },
  { name: 'manage-channels', screen: 'Gestión de canales', run: (p) => visit(p, '/manage-channels', false) },
  {
    name: 'search',
    screen: 'Búsqueda · resultados',
    run: async (p) => {
      await visit(p, '/search', false);
      const box = p.getByRole('searchbox').or(p.getByRole('textbox')).first();
      if (await box.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await box.fill('Tatort');
        await box.press('Enter'); // lanzar la búsqueda (resultados), no solo sugerencias
        await settle(p, 4000);
        await scrollThrough(p, 4);
        // abrir el primer resultado para disparar su ficha
        const first = p.locator('a[href*="/details/"]').first();
        const href = await first.getAttribute('href', { timeout: 8000 }).catch(() => null);
        if (href) {
          await goToApp(p, href);
          await settle(p, 2500);
        }
      }
    },
  },
  {
    name: 'search-suggestions',
    screen: 'Búsqueda · sugerencias mientras se escribe',
    run: async (p) => {
      await visit(p, '/search', false);
      const box = p.getByRole('searchbox').or(p.getByRole('textbox')).first();
      if (await box.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await box.pressSequentially('Tat', { delay: 400 }); // no Enter: suggestions only
        await settle(p, 3000);
      }
    },
  },
  { name: 'content-grid', screen: 'Rejilla "ver todo" de un área temática', run: async (p) => void (await openFirstDetail(p, '/catalog/mediathek-14798', '/catalog/contents/')) },
  {
    // Cada subsección de Ajustes llama a su propio endpoint (dispositivos, paquetes, webview autenticada…).
    name: 'settings-sections',
    screen: 'Ajustes · todas las subsecciones (canales, dispositivos, PIN, paquetes, legal…)',
    run: async (p) => {
      await visit(p, '/settings', false);
      const hrefs = await p
        .locator('a[href*="/settings?pid="]')
        .evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))].filter(Boolean));
      for (const href of hrefs) {
        await goToApp(p, href);
        await settle(p, 2000);
      }
    },
  },
  {
    name: 'subscription-detail',
    screen: 'Ajustes · TV-Pakete · ficha de un paquete contratado',
    run: async (p) => {
      if (await openFirstDetail(p, '/settings?pid=SET322', '/details/subscription/')) return;
      // Las tarjetas de paquete no siempre son enlaces: clic en la primera de "Meine TV-Pakete".
      const card = p.getByText(/Meine TV-Pakete/).first().locator('xpath=following::*[self::a or self::button or @role="button" or @tabindex][1]');
      await card.click({ timeout: 8000 }).catch(() => {});
      await settle(p, 3000);
    },
  },
  {
    // Ficha de un contenido que el usuario NO tiene contratado y se ofrece con un paquete: la única
    // que trae `subscriptions` con precios. Se elige de lo que devuelven los catálogos (no del DOM).
    name: 'detail-subscribable',
    screen: 'Ficha de un contenido contratable con un paquete (botón suscribirse)',
    run: async (p) => {
      const found: string[] = [];
      const collect = (v: unknown): void => {
        if (Array.isArray(v)) v.forEach(collect);
        else if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          const buttons = o.buttons as Record<string, unknown> | undefined;
          if (typeof o.pid === 'string' && /^(MOV|SER)\d+$/.test(o.pid) && buttons?.isSubscribeVisible === true) found.push(o.pid);
          Object.values(o).forEach(collect);
        }
      };
      const onResponse = async (r: import('@playwright/test').Response) => {
        if (!/thematic-site-page|thematic-grid-page|\/carousel/.test(r.url())) return;
        try {
          collect(await r.json());
        } catch {
          /* no JSON */
        }
      };
      p.on('response', onResponse);
      for (const from of ['/catalog/mediathek-14798', '/catalog/streaming-19341', '/']) {
        await visit(p, from, from === '/'); // scroll solo en la home (carruseles bajo demanda)
        if (found.length >= 3) break;
      }
      p.off('response', onResponse);
      // Algunos contenidos ofrecidos responden 404 en la ficha (se guarda en `errors`): probar hasta 5.
      for (const pid of [...new Set(found)].slice(0, 5)) {
        const num = pid.replace(/^\D+/, '');
        const detail = p.waitForResponse((r) => r.url().includes(`/unified-detailed/${pid}`), { timeout: 10000 }).catch(() => null);
        await goToApp(p, pid.startsWith('SER') ? `/details/serie/${num}` : `/details/movie/qa-${num}`);
        const res = await detail;
        await settle(p, 2000);
        if (res?.ok()) return;
      }
    },
  },
  {
    // Provoca a propósito el error de un pid inexistente (la captura guarda los 4xx en `errors`).
    name: 'detail-invalid',
    screen: 'Ficha de un contenido inexistente (pantalla de error)',
    run: async (p) => {
      await goToApp(p, '/details/movie/qa-invalid-999999999');
      await settle(p, 2500);
    },
  },
  { name: 'detail-live-serie', screen: 'Ficha de serie en directo (LSR)', run: async (p) => void (await openFirstDetail(p, '/tv-guide/now', '/details/live-serie/')) },
  { name: 'detail-recording-serie', screen: 'Ficha de serie grabada (Verfügbare Aufnahmen)', run: (p) => openRecordingCard(p, 'Verfügbare Aufnahmen') },
  { name: 'detail-recording-scheduled', screen: 'Ficha de grabación programada (Geplante Aufnahmen)', run: (p) => openRecordingCard(p, 'Geplante Aufnahmen') },
  { name: 'detail-movie', screen: 'Ficha de película', run: async (p) => void (await openFirstDetail(p, '/catalog/videothek-15640', '/details/movie/')) },
  { name: 'detail-serie', screen: 'Ficha de serie', run: async (p) => void (await openFirstDetail(p, '/catalog/mediathek-14798', '/details/serie/')) },
  { name: 'detail-live', screen: 'Ficha de directo', run: async (p) => void (await openFirstDetail(p, '/tv-guide/now', '/details/live')) },
  {
    name: 'player',
    screen: 'Player (VOD/live: vmap, thumbnails, blender)',
    run: async (p) => {
      if (!(await openFirstDetail(p, '/tv-guide/now', '/details/live'))) return;
      const play = p.locator('button:has-text("Abspielen"), button:has-text("Ansehen"), button[aria-label*="play" i], [class*="playButton"]').first();
      if (await play.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await play.click().catch(() => {});
        await p.waitForTimeout(15000);
      }
    },
  },
  {
    name: 'player-vod',
    screen: 'Player VOD (información de reproducción VOD)',
    run: async (p) => {
      if (!(await openFirstDetail(p, '/catalog/mediathek-14798', '/details/'))) return;
      const play = p.locator('button:has-text("Abspielen"), button:has-text("Ansehen"), button:has-text("Weiterschauen"), button[aria-label*="play" i], [class*="playButton"]').first();
      if (await play.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await play.click().catch(() => {});
        await p.waitForTimeout(12000);
      }
    },
  },
  {
    name: 'profile-avatars',
    screen: 'Perfiles · edición y avatares (GetAvatars)',
    run: async (p) => {
      await visit(p, '/profiles/list', false);
      // Botón "… ändern" (editar perfil) abre la edición, que pide la lista de avatares.
      const edit = p.locator('button[aria-label*="ändern" i], a[href*="/profiles/edit"], a[href*="/profiles/"][href*="edit"]').first();
      if (await edit.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
        await edit.click().catch(() => {});
        await settle(p, 3000);
        // Entrar al selector de avatar si aparece.
        const avatar = p.locator('button:has-text("Avatar"), [class*="avatar" i] button, a[href*="avatar" i]').first();
        await avatar.click({ timeout: 5000 }).catch(() => {});
        await settle(p, 2500);
      }
    },
  },
  {
    name: 'epg-detail',
    screen: 'EPG · ficha de programa',
    run: async (p) => void (await openFirstDetail(p, '/tv-guide/epg', '/details/')),
  },
];

export const SCREEN_BY_JOURNEY: Record<string, string> = Object.fromEntries(JOURNEYS.map((j) => [j.name, j.screen]));
