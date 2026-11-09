/**
 * scripts/diff-contracts.ts — What changed in the canoway API between two app versions.
 *
 *   npm run contracts:diff -- 26.10.100 26.11.100
 *
 * Writes contracts/diff_<from>_<to>.md (ready to paste into Jira/Confluence)
 * and exits 1 when there are breaking changes (removed fields / type changes).
 */
import * as fs from 'fs';
import * as path from 'path';
import { paths, ROOT } from '../src/config/env';
import { diffShapes, type Shape } from '../src/contracts/shape';

const [from, to] = process.argv.slice(2);
if (!from || !to) {
  console.error('usage: npm run contracts:diff -- <fromVersion> <toVersion>');
  process.exit(2);
}

function load(version: string): Map<string, Shape> {
  const dir = paths.contracts(version);
  const out = new Map<string, Shape>();
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { endpointId: string; shape: Shape };
    out.set(c.endpointId, c.shape);
  }
  return out;
}

const a = load(from);
const b = load(to);
const lines = [`# canoway: cambios de contrato ${from} → ${to}`, ''];
let breaking = 0;

const removedEndpoints = [...a.keys()].filter((k) => !b.has(k));
const newEndpoints = [...b.keys()].filter((k) => !a.has(k));
if (newEndpoints.length) lines.push('## Endpoints nuevos', ...newEndpoints.map((e) => `- \`${e}\``), '');
if (removedEndpoints.length) lines.push('## Endpoints que la app ya no llama', ...removedEndpoints.map((e) => `- \`${e}\``), '');

lines.push('## Cambios por endpoint', '');
for (const [id, shapeA] of a) {
  const shapeB = b.get(id);
  if (!shapeB) continue;
  const d = diffShapes(shapeA, shapeB);
  if (!d.removed.length && !d.added.length && !d.typeChanged.length && !d.becameOptional.length) continue;
  breaking += d.removed.length + d.typeChanged.length;
  lines.push(`### \`${id}\``);
  if (d.removed.length) lines.push('**❌ Campos eliminados (rompe):**', ...d.removed.map((p) => `- \`${p}\``));
  if (d.typeChanged.length) lines.push('**❌ Tipo cambiado (rompe):**', ...d.typeChanged.map((t) => `- \`${t.path}\`: ${t.from} → ${t.to}`));
  if (d.becameOptional.length) lines.push('**⚠️ Ya no siempre presentes:**', ...d.becameOptional.map((p) => `- \`${p}\``));
  if (d.added.length) lines.push('**➕ Campos nuevos:**', ...d.added.map((p) => `- \`${p}\``));
  lines.push('');
}

const out = path.join(ROOT, 'contracts', `diff_${from}_${to}.md`);
fs.writeFileSync(out, lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\n→ ${path.relative(ROOT, out)}  (${breaking} breaking change(s))`);
process.exit(breaking ? 1 : 0);
