/**
 * scripts/publish-jira.ts — Publica el resultado de una tanda en Jira: una "Test Case Execution"
 * (subtarea del TC en MULTISTC) por cada TC, con estado Pass / Fail / Block.
 *
 *   npx tsx scripts/publish-jira.ts <results.json> [<results.json> …]            → solo muestra el plan
 *   npx tsx scripts/publish-jira.ts <results.json> … --publish [--label X]       → crea las ejecuciones
 *
 * Cada TC se identifica por el `[MULTISTC-…]` del título de la prueba. Si varias pruebas apuntan al
 * mismo TC: alguna falla → Fail; todas omitidas → Block; si no → Pass.
 * Credenciales en BFF/.env (nunca en git): JIRA_URL (p. ej. https://jira.tid.es) y JIRA_PAT (token personal).
 */
import * as fs from 'fs';
import * as path from 'path';
import { env } from '../src/config/env';
import { loadLiveCapture } from '../src/testing/live-capture';

type Verdict = 'Pass' | 'Fail' | 'Block';
interface TestRow { jira: string | null; title: string; file: string; status: string; error: string; skipReason: string; durationMs: number }

const args = process.argv.slice(2);
const files = args.filter((a) => a.endsWith('.json'));
const publish = args.includes('--publish');
const day = new Date().toISOString().slice(0, 10);
const label = args.includes('--label') ? args[args.indexOf('--label') + 1]! : `GOBFF_auto_${env.appVersion}_Web`;
if (!files.length) {
  console.error('Uso: npx tsx scripts/publish-jira.ts <results.json> [...] [--publish] [--label X]');
  process.exit(2);
}

const ANSI = /\u001b\[[0-9;]*m/g;
function rows(file: string): TestRow[] {
  const out: TestRow[] = [];
  const walk = (s: any) => {
    (s.suites ?? []).forEach(walk);
    for (const sp of s.specs ?? [])
      for (const t of sp.tests ?? []) {
        const last = t.results?.[t.results.length - 1];
        if (!last) continue;
        const skip = (t.annotations ?? []).find((a: any) => a.type === 'skip')?.description ?? '';
        const err = (last.errors ?? []).map((e: any) => String(e.message ?? '').replace(ANSI, '').split('\n')[0]).join(' | ');
        out.push({ jira: (t.annotations ?? []).find((a: any) => a.type === 'jira')?.description ?? null, title: sp.title, file: sp.file, status: last.status, error: err, skipReason: skip, durationMs: last.duration ?? 0 });
      }
  };
  JSON.parse(fs.readFileSync(file, 'utf8')).suites.forEach(walk);
  return out;
}

const byTc = new Map<string, TestRow[]>();
for (const f of files) for (const r of rows(f)) {
  const key = r.title.match(/\[(MULTISTC-\d+)\]/)?.[1] ?? r.jira ?? undefined;
  if (key) byTc.set(key, [...(byTc.get(key) ?? []), r]);
}

function verdict(list: TestRow[]): Verdict {
  if (list.some((r) => ['failed', 'timedOut', 'interrupted'].includes(r.status))) return 'Fail';
  if (list.every((r) => r.status === 'skipped')) return 'Block';
  return 'Pass';
}

function notes(list: TestRow[]): string {
  return list
    .map((r) => {
      const head = `${r.status.toUpperCase()} · ${r.title} (${(r.durationMs / 1000).toFixed(1)} s)`;
      const why = r.status === 'skipped' ? r.skipReason : r.error;
      return why ? `${head}\n  ${why.slice(0, 600)}` : head;
    })
    .join('\n');
}

/** Versión que reporta el BFF (la más frecuente en la captura), para "Executed in Build". */
function bffVersion(): string {
  const cap = loadLiveCapture();
  const count = new Map<string, number>();
  for (const list of Object.values(cap?.endpoints ?? {})) for (const s of list) {
    const v = (s.body as { version?: unknown } | null)?.version;
    if (typeof v === 'string') count.set(v, (count.get(v) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'desconocida';
}

const build = `Web ${env.appVersion} · BFF ${bffVersion()}`;
const plan = [...byTc].sort(([a], [b]) => a.localeCompare(b)).map(([key, list]) => ({ key, verdict: verdict(list), notes: notes(list) }));
const tally = (v: Verdict) => plan.filter((p) => p.verdict === v).length;
console.log(`Tanda ${day} · ${build} · etiqueta ${label}`);
console.log(`${plan.length} TCs: ${tally('Pass')} Pass · ${tally('Fail')} Fail · ${tally('Block')} Block`);
for (const p of plan) if (p.verdict !== 'Pass') console.log(`  ${p.verdict.padEnd(5)} ${p.key}: ${p.notes.split('\n')[1]?.trim() ?? ''}`);

async function main() {
  if (!publish) {
    console.log('\n(solo plan: añade --publish para crear las ejecuciones en Jira)');
    return;
  }
  const base = (process.env.JIRA_URL ?? '').replace(/\/$/, '');
  const token = process.env.JIRA_PAT ?? '';
  if (!base || !token) throw new Error('Faltan JIRA_URL y/o JIRA_PAT en BFF/.env.');
  const api = async (method: string, p: string, body?: unknown) => {
    const res = await fetch(`${base}/rest/api/2/${p}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };

  const created: string[] = [];
  for (const p of plan) {
    const tc = await api('GET', `issue/${p.key}?fields=summary,labels`);
    // Nunca escribir en un TC ajeno: solo los del framework (label GOBFF_aut).
    if (!(tc.fields.labels ?? []).includes('GOBFF_aut')) {
      console.warn(`  ${p.key}: no tiene la label GOBFF_aut, se omite.`);
      continue;
    }
    const exec = await api('POST', 'issue', {
      fields: {
        project: { key: 'MULTISTC' },
        parent: { key: p.key },
        issuetype: { name: 'Test Case Execution' },
        summary: `Execution of ${tc.fields.summary}`.slice(0, 250),
        labels: [label, 'GOBFF_aut'],
        customfield_10155: new Date().toISOString().replace('Z', '+0000'),
        customfield_10157: build,
        customfield_10074: p.notes.slice(0, 30000),
      },
    });
    const transitions = (await api('GET', `issue/${exec.key}/transitions`)).transitions as { id: string; name: string }[];
    const t = transitions.find((x) => x.name === p.verdict);
    if (!t) throw new Error(`${exec.key}: no hay transición "${p.verdict}" (hay: ${transitions.map((x) => x.name).join(', ')})`);
    await api('POST', `issue/${exec.key}/transitions`, { transition: { id: t.id } });
    created.push(`${exec.key} ← ${p.key} ${p.verdict}`);
    console.log(`  ${exec.key} ← ${p.key}: ${p.verdict}`);
  }
  const report = path.join(path.dirname(files[0]!), `jira-${day}.txt`);
  fs.writeFileSync(report, created.join('\n') + '\n');
  console.log(`\n${created.length} ejecuciones creadas (lista en ${path.relative(process.cwd(), report)}).`);
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
