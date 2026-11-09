/**
 * scripts/contracts-from-live.ts — Crea el contrato de los endpoints que la captura en vivo ha visto
 * y que todavía no tienen contrato (p. ej. un endpoint nuevo que la web empezó a llamar).
 * No toca los contratos existentes.   npm run contracts:from-live [-- <endpointId> ...]
 */
import * as fs from 'fs';
import * as path from 'path';
import { endpointSlug } from '../src/catalog/endpoint-id';
import { env, paths } from '../src/config/env';
import { inferFromSamples } from '../src/contracts/shape';
import { loadLiveCapture } from '../src/testing/live-capture';

/** Respuestas de un mismo endpoint con otra forma: van a su propio contrato `<slug>~<name>.json`. */
export const CONTRACT_VARIANTS: Record<string, { name: string; shapes: RegExp }[]> = {
  'GET nsh/unified-detailed/{pid}': [{ name: 'RSR', shapes: /unified-detailed\/RSR/ }],
};

const capture = loadLiveCapture();
if (!capture) throw new Error('No hay captura en vivo: ejecuta "npm run live".');
const only = process.argv.slice(2);
const dir = paths.contracts(env.appVersion);
const jobs: { id: string; samples: typeof capture.endpoints[string] }[] = [];
for (const [id, samples] of Object.entries(capture.endpoints)) {
  const variants = CONTRACT_VARIANTS[id] ?? [];
  jobs.push({ id, samples: samples.filter((s) => !variants.some((v) => v.shapes.test(s.shape))) });
  for (const v of variants) jobs.push({ id: `${id}~${v.name}`, samples: samples.filter((s) => v.shapes.test(s.shape)) });
}
for (const { id, samples } of jobs) {
  if (only.length && !only.includes(id)) continue;
  const file = path.join(dir, `${endpointSlug(id)}.json`);
  if (fs.existsSync(file) || !samples.length) continue;
  const bodies = samples.filter((s) => s.isJson).map((s) => s.body);
  const shape = inferFromSamples(bodies);
  if (!shape) continue;
  fs.writeFileSync(file, JSON.stringify({ endpointId: id, samples: bodies.length, source: `live ${capture.capturedAt}`, shape }, null, 2));
  console.log(`[contracts] nuevo: ${path.relative(process.cwd(), file)} (${bodies.length} muestra/s)`);
}
