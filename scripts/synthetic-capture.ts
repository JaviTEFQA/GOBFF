/**
 * scripts/synthetic-capture.ts — Captura SINTÉTICA para comprobar las reglas de negocio con datos
 * que la cuenta de pruebas no tiene (perfil infantil, adultos, deportes, LSE/AD, widget type 63,
 * estados de contratación).
 *
 * Parte de la captura real (.live/<ver>/capture.json) y genera dos ficheros:
 *   - synthetic-ok.json: se añaden esos casos tal como los pide la especificación → las pruebas deben PASAR.
 *   - synthetic-ko.json: los mismos casos con un defecto plantado en cada uno → las pruebas deben FALLAR.
 *
 * Importante: esto NO valida el BFF (un mock dice lo que le pongamos). Valida que las reglas ya escritas
 * se activan y detectan el defecto cuando esos datos aparezcan en la captura real.
 *
 * Uso: npm run synthetic   (genera y ejecuta las pruebas afectadas con ambas capturas)
 */
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../src/config/env';
import { EXTRA_CONTENTAPI_CHA, type LiveCapture, type LiveSample } from '../src/testing/live-capture';

type Obj = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const dir = path.join(__dirname, '..', '.live', env.appVersion);
const real = JSON.parse(fs.readFileSync(path.join(dir, 'capture.json'), 'utf8')) as LiveCapture;

/** Aplica `fn` a todo objeto con pid === `pid` en todos los endpoints. */
function everyObject(cap: LiveCapture, pid: string, fn: (o: Obj) => void): number {
  let n = 0;
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Obj;
      if (o.pid === pid) {
        fn(o);
        n++;
      }
      Object.values(o).forEach(walk);
    }
  };
  for (const list of Object.values(cap.endpoints)) for (const s of list) walk(s.body);
  return n;
}

/** Samples de un endpoint de la captura (falla si la captura real no lo trae). */
function list(cap: LiveCapture, id: string): LiveSample[] {
  const l = cap.endpoints[id];
  if (!l?.length) throw new Error(`La captura real no trae ${id}: ejecuta antes "npm run test:api".`);
  return l;
}
const first = (cap: LiveCapture, id: string): LiveSample => list(cap, id)[0]!;

function sample(base: LiveSample, url: string, body: unknown, journey: string): LiveSample {
  const u = new URL(url);
  const rel = u.pathname.replace(/^.*\/service\//, '') + u.search;
  return { ...clone(base), url, key: `${base.method} ${rel}`, body, journey, at: Date.now() };
}

/** Un MOV que aparezca en al menos dos endpoints (para probar la coherencia entre pantallas). */
function sharedMovie(cap: LiveCapture): string {
  const seen = new Map<string, Set<string>>();
  for (const [id, samples] of Object.entries(cap.endpoints))
    for (const s of samples)
      for (const [, pid] of JSON.stringify(s.body).matchAll(/"pid":"(MOV\d+)"/g)) {
        if (!pid) continue;
        if (!seen.has(pid)) seen.set(pid, new Set());
        seen.get(pid)!.add(id);
      }
  const hit = [...seen].find(([, ids]) => ids.size >= 2);
  if (!hit) throw new Error('No hay ningún MOV en dos endpoints de la captura real.');
  return hit[0];
}

function build(variant: 'ok' | 'ko'): LiveCapture {
  const ok = variant === 'ok';
  const cap = clone(real);
  cap.capturedAt = new Date().toISOString();
  cap.journeys = [...cap.journeys, `synthetic-${variant}`];
  const notes: string[] = [];

  // 1. Perfil infantil (GO-36935 · MULTISTC-76673): parrilla pedida con is_kids=true.
  {
    const base = first(cap, 'GET channels');
    const kids = (base.body as Obj).channels.filter((c: Obj) => /kika|nick|junior|toggo|cartoon|boomerang|baby/i.test(c.title)).slice(0, 5);
    for (const c of kids) everyObject(cap, c.pid, (o) => (o.isKids = true));
    const grid = kids.map((c: Obj) => ({ ...clone(c), isKids: true }));
    if (!ok) grid.push({ ...clone((base.body as Obj).channels.find((c: Obj) => !kids.includes(c))), isKids: false }); // KO: canal adulto en la parrilla infantil
    list(cap, 'GET channels').push(sample(base, base.url.replace('is_kids=false', 'is_kids=true'), { ...clone(base.body as Obj), channels: grid }, 'synthetic-kids'));
    notes.push(`infantil: ${kids.map((c: Obj) => c.pid).join(', ')}${ok ? '' : ' + 1 canal no infantil'}`);
  }

  // 2. Sección de adultos (GO-36535 · MULTISTC-76674).
  {
    const menu = first(cap, 'GET nsh/menu').body as Obj;
    menu.menu.topMenu.push({ pid: 'CHA99001', titleInMenu: 'Erotik (sintético)', opensNewWindow: false, requiresPin: ok, showGrid: true, showAllPid: 'CHA99001' }); // KO: false con ContentAPI True
    const ca = cap.extras?.[EXTRA_CONTENTAPI_CHA]?.body as Obj | undefined;
    ca?.Content?.List?.push({ Pid: 'CHA99001', Title: 'Erotik (sintético)', Attributes: { ca_requiresPin: ['True'] } });
    const site = first(cap, 'GET nsh/thematic-site-page/{pid}');
    if (ok) for (const s of list(cap, 'GET nsh/thematic-site-page/{pid}')) (s.body as Obj).requiresPin = false; // el BFF corregido (GO-37994)
    const adultSite = clone(site.body as Obj);
    adultSite.thematicSite = adultSite.thematicSite.slice(0, 2).map((c: Obj, i: number) => ({ ...c, pid: `CHA9900${i + 2}`, showAllPid: `CHA9900${i + 2}`, requiresPin: true }));
    for (const c of adultSite.thematicSite) ca?.Content?.List?.push({ Pid: c.pid, Title: `${c.title} (sintético)`, Attributes: { ca_requiresPin: ['True'] } });
    if (ok) adultSite.requiresPin = true;
    list(cap, 'GET nsh/thematic-site-page/{pid}').push(sample(site, site.url.replace(/CHA\d+/, 'CHA99001'), adultSite, 'synthetic-adult'));
    const carousel = first(cap, 'POST nsh/carousel').body as Obj;
    const item = carousel.carousels.flatMap((c: Obj) => c.contents ?? []).find((i: Obj) => /^MOV/.test(i.pid));
    if (item) item.requiresPin = true;
    notes.push(`adultos: menú CHA99001 requiresPin=${ok}, ContentAPI True${ok ? ', raíz de ThematicSitePage informada' : ', raíz de ThematicSitePage sin requiresPin'}`);
  }

  // 3. Ficha deportiva (GO-36571 · MULTISTC-76680).
  {
    const base = list(cap, 'GET nsh/unified-detailed/{pid}').find((s) => /^LSR/.test((s.body as Obj).pid) && (s.body as Obj).relevantEpisode)!;
    const d = clone(base.body as Obj);
    d.pid = 'LSR99001';
    d.isSport = true;
    d.renderChild = true;
    d.seasons = (d.seasons ?? [{ pid: 'LSE99001' }]).map((s: Obj, i: number) => (ok ? { ...s, title: `Saison ${i + 1}` } : { ...s, title: undefined }));
    d.relevantEpisode.buttons = { ...d.relevantEpisode.buttons, isRecordingSeriesVisible: !ok, isRecordingSeasonVisible: false };
    const rel = d.relevantEpisode.pid;
    const eps = (d.relevantSeason?.episodes ?? []).filter((e: Obj) => e.pid !== rel);
    d.relevantSeason = { ...(d.relevantSeason ?? {}), episodes: ok ? eps : [clone(d.relevantEpisode), ...eps] };
    list(cap, 'GET nsh/unified-detailed/{pid}').push(sample(base, base.url.replace(/LSR\d+/, 'LSR99001'), d, 'synthetic-sport'));
    notes.push(`deporte: LSR99001 isSport=true${ok ? '' : ' sin títulos de temporada, grabar serie visible y episodio repetido'}`);
  }

  // 4. Iconos LSE y AD (GO-36549 · MULTISTC-76681).
  {
    const pid = sharedMovie(cap);
    let first = true;
    const n = everyObject(cap, pid, (o) => {
      o.is5s = ok ? true : first;
      o.isAudioDescription = true;
      first = false;
    });
    notes.push(`LSE/AD: ${pid} (${n} apariciones) ${ok ? 'is5s=true en todas' : 'is5s distinto según la pantalla'}`);
  }

  // 5. Widget dinámico type 63 (GO-36521 · MULTISTC-76655).
  {
    const settings = first(cap, 'GET nsh/settings').body as Obj;
    settings.childSettings.push(
      ok
        ? { pid: 'SET99063', contentType: 'SET', title: 'O2 Mehr (sintético)', type: 63, url: 'https://www.o2online.de/', newTab: false, sso: true }
        : { pid: 'SET99063', contentType: 'SET', title: 'O2 Mehr (sintético)', type: 63, newTab: null, sso: true, modalTitle: 'Scan' },
    );
    notes.push(`widget 63: SET99063${ok ? '' : ' sin url, newTab null y con modalTitle'}`);
  }

  // 6. Estados de contratación del paquete (GO-36315 · MULTISTC-76683).
  {
    const base = first(cap, 'GET nsh/subscription/{pid}');
    const states: [string, Obj, Obj][] = [
      ['SUB99001', { isActivatedPendingVisible: true }, { isAddSubscriptionVisible: !ok, isCancelSubscriptionVisible: false, isMoreDetailVisible: true, isTermsAndConditionsVisible: false }],
      ['SUB99002', { isCancellationPendingVisible: true, ...(ok ? {} : { isActivatedVisible: true }) }, { isAddSubscriptionVisible: false, isCancelSubscriptionVisible: false, isMoreDetailVisible: true, isTermsAndConditionsVisible: false }],
      ['SUB99003', { isNotSubscribed: true }, { isAddSubscriptionVisible: true, isCancelSubscriptionVisible: false, isMoreDetailVisible: false, isTermsAndConditionsVisible: !ok }],
    ];
    for (const [pid, bars, buttons] of states) {
      const b = clone(base.body as Obj);
      b.pid = pid;
      b.bars = { isActivatedPendingVisible: false, isCancellationPendingVisible: false, isActivatedVisible: false, isNotSubscribed: false, ...bars };
      b.buttons = buttons;
      delete b.services;
      list(cap, 'GET nsh/subscription/{pid}').push(sample(base, base.url.replace(/SUB\d+/, pid), b, 'synthetic-subscription'));
    }
    notes.push(`paquetes: SUB99001 en contratación, SUB99002 en cancelación, SUB99003 no contratado${ok ? '' : ' (con botones o estados incoherentes)'}`);
  }

  console.log(`[synthetic-${variant}]\n  - ${notes.join('\n  - ')}`);
  return cap;
}

for (const v of ['ok', 'ko'] as const) {
  const file = path.join(dir, `synthetic-${v}.json`);
  fs.writeFileSync(file, JSON.stringify(build(v)));
  console.log(`  → ${path.relative(process.cwd(), file)}`);
}

// --run: ejecuta las pruebas afectadas con ambas capturas y comprueba OK → pasan, KO → fallan todas.
if (process.argv.includes('--run')) {
  const { spawnSync } = require('child_process') as typeof import('child_process');
  const TESTS = ['tests/canales/infantil', 'tests/control-parental/pin-adultos', 'tests/fichas/deportes', 'tests/fichas/iconos-lse-ad', 'tests/ajustes/widgets', 'tests/suscripciones/estado'];
  let bad = false;
  for (const v of ['ok', 'ko'] as const) {
    const out = path.join(dir, `synthetic-${v}-results.json`);
    spawnSync('npx', ['playwright', 'test', '--project=api', ...TESTS, '--reporter=json'], {
      shell: true,
      env: { ...process.env, LIVE_CAPTURE_FILE: path.relative(path.join(__dirname, '..'), path.join(dir, `synthetic-${v}.json`)), PLAYWRIGHT_JSON_OUTPUT_NAME: out },
      stdio: 'ignore',
    });
    const r = JSON.parse(fs.readFileSync(out, 'utf8'));
    const rows: { title: string; status: string }[] = [];
    const walk = (s: any) => { (s.suites ?? []).forEach(walk); for (const sp of s.specs ?? []) if (/MULTISTC/.test(sp.title) && !/setup/.test(sp.file)) rows.push({ title: sp.title, status: sp.ok ? 'pasa' : 'falla' }); };
    r.suites.forEach(walk);
    const expected = v === 'ok' ? 'pasa' : 'falla';
    console.log(`\n${v.toUpperCase()} (se espera que todas ${expected === 'pasa' ? 'pasen' : 'fallen'}):`);
    for (const row of rows) {
      const good = row.status === expected;
      bad ||= !good;
      console.log(`  ${good ? '✔' : '✘'} ${row.status.padEnd(5)} ${row.title}`);
    }
  }
  console.log(bad ? '\nAlguna regla no se comporta como se espera.' : '\nTodas las reglas se activan y detectan el defecto plantado.');
  process.exit(bad ? 1 : 0);
}
