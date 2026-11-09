/**
 * src/testing/readme.ts — The per-test README contract (Jira context).
 *
 * Every test folder under tests/api and tests/ui-mocked holds one spec and one
 * README.md. The README is what gets pasted / linked into the Jira test case,
 * so it must say what the test does and what it affects. These sections are
 * mandatory; tests/unit/readme-audit.spec.ts fails when one is missing.
 */
import * as fs from 'fs';
import * as path from 'path';

export const REQUIRED_SECTIONS = [
  'Qué hace',
  'Endpoints afectados',
  'Pantallas / funcionalidad afectada',
  'Precondiciones',
  'Datos y mocks',
  'Resultado esperado',
  'Cómo ejecutar',
] as const;

export interface ReadmeInfo {
  file: string;
  title: string;
  jira: string | null;
  missingSections: string[];
  content: string;
}

export function readReadme(dir: string): ReadmeInfo | null {
  const file = path.join(dir, 'README.md');
  if (!fs.existsSync(file)) return null;
  const content = fs.readFileSync(file, 'utf8');
  const headings = [...content.matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => m[1]!.trim().toLowerCase());
  const jira = content.match(/\|\s*Jira\s*\|\s*([A-Z][A-Z0-9]+-\d+)/)?.[1] ?? null;
  return {
    file,
    title: content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(dir),
    jira,
    missingSections: REQUIRED_SECTIONS.filter((s) => !headings.includes(s.toLowerCase())),
    content,
  };
}

export interface ReadmeSpec {
  title: string;
  type: string;
  priority: string;
  version: string;
  queHace: string;
  endpoints: string[];
  pantallas: string[];
  precondiciones: string[];
  datos: string[];
  pasos?: string[];
  resultado: string[];
  comando: string;
  notas?: string[];
}

const list = (xs: string[]) => xs.map((x) => `- ${x}`).join('\n');

export function renderReadme(s: ReadmeSpec): string {
  return `# ${s.title}

| Campo | Valor |
|---|---|
| Jira | _pendiente_ |
| Tipo | ${s.type} |
| Prioridad | ${s.priority} |
| Versión base | ${s.version} |

## Qué hace
${s.queHace}

## Endpoints afectados
${list(s.endpoints.map((e) => `\`${e}\``))}

## Pantallas / funcionalidad afectada
${list(s.pantallas)}

## Precondiciones
${list(s.precondiciones)}

## Datos y mocks
${list(s.datos)}
${s.pasos ? `\n## Pasos\n${s.pasos.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n` : ''}
## Resultado esperado
${list(s.resultado)}

## Cómo ejecutar
\`\`\`
${s.comando}
\`\`\`
${s.notas?.length ? `\n## Notas\n${list(s.notas)}\n` : ''}`;
}
