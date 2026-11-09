/**
 * src/contracts/registry.ts — Build, persist and load per-endpoint contracts.
 *
 *   contracts/<version>/<endpoint-slug>.json   inferred Shape of the 2xx JSON body
 *   contracts/overrides.json                   hand-maintained relaxations (stable across versions)
 *
 * overrides.json example:
 *   {
 *     "GET nsh/home": { "optional": ["$.home[].contents[].triangles"] },
 *     "GET nsh/unified-detailed-content/{pid}": { "optional": ["$.debug*"], "skipContract": false }
 *   }
 */
import * as fs from 'fs';
import * as path from 'path';
import { paths } from '../config/env';
import { endpointSlug } from '../catalog/endpoint-id';
import { groupByEndpoint, type RecordedExchange } from '../recordings/store';
import { inferFromSamples, type Shape } from './shape';

export interface ContractOverride {
  optional?: string[];
  skipContract?: boolean;
  /** Per-endpoint latency budget (ms) overriding API_LATENCY_BUDGET_MS. */
  latencyBudgetMs?: number;
}

export function buildContracts(exchanges: RecordedExchange[], version?: string): string[] {
  const dir = paths.contracts(version);
  fs.mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  for (const [id, list] of groupByEndpoint(exchanges)) {
    const bodies = list.filter((e) => e.response.isJson && e.response.status < 300).map((e) => e.response.body);
    const shape = inferFromSamples(bodies);
    if (!shape) continue;
    const file = path.join(dir, `${endpointSlug(id)}.json`);
    fs.writeFileSync(file, JSON.stringify({ endpointId: id, samples: bodies.length, shape }, null, 2));
    written.push(file);
  }
  return written;
}

export function loadContract(endpointIdValue: string, version?: string): Shape | null {
  const file = path.join(paths.contracts(version), `${endpointSlug(endpointIdValue)}.json`);
  if (!fs.existsSync(file)) return null;
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { shape: Shape }).shape;
}

export function loadOverrides(): Record<string, ContractOverride> {
  if (!fs.existsSync(paths.contractOverrides)) return {};
  return JSON.parse(fs.readFileSync(paths.contractOverrides, 'utf8')) as Record<string, ContractOverride>;
}
