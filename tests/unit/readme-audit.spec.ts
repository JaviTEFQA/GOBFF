/**
 * Guardrail: every test folder under tests/api and tests/ui-mocked has exactly
 * one spec and a README.md with all the sections Jira needs.
 */
import * as fs from 'fs';
import * as path from 'path';
import { expect, test } from '@playwright/test';
import { ROOT } from '../../src/config/env';
import { readReadme } from '../../src/testing/readme';

function specDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name.endsWith('.spec.ts'))) out.push(d);
    entries.filter((e) => e.isDirectory()).forEach((e) => walk(path.join(d, e.name)));
  };
  walk(root);
  return out;
}

// Pruebas de uso: todo lo que hay bajo tests/, menos el framework (unit), el setup y el grabador.
const EXCLUDE = new Set(['unit', 'setup', 'record']);
const testsRoot = path.join(ROOT, 'tests');
const dirs = fs
  .readdirSync(testsRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !EXCLUDE.has(e.name))
  .flatMap((e) => specDirs(path.join(testsRoot, e.name)));

test('there are tests to audit', () => expect(dirs.length).toBeGreaterThan(0));

for (const dir of dirs) {
  const rel = path.relative(ROOT, dir).replace(/\\/g, '/');
  test(`README complete: ${rel}`, () => {
    const specs = fs.readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));
    expect(specs, 'one test per folder (independent, one README each)').toHaveLength(1);
    const readme = readReadme(dir);
    expect(readme, `${rel}/README.md missing`).not.toBeNull();
    expect(readme!.missingSections, `${rel}/README.md missing sections`).toEqual([]);
  });
}
