/**
 * src/testing/contract-test.ts — Regresión de contrato de un endpoint de canoway.
 *
 *   // tests/api/contract/GET__nsh_menu/contract.spec.ts
 *   defineContractTest('GET nsh/menu', { smoke: true });
 *
 * canoway firma CADA petición (la firma cambia por llamada y caduca en segundos), así que no se
 * pueden reenviar peticiones a mano: todas darían 401. En su lugar, el setup `live-capture` abre un
 * navegador logado, deja que la app pida los datos y guarda cada respuesta 2xx en
 * .live/<versión>/capture.json. Esta prueba valida esas respuestas reales:
 *   1. hubo respuesta 2xx de la app para el endpoint;
 *   2. el cuerpo JSON cumple el esquema contracts/<versión>/<slug>.json
 *      (campo que falta o cambia de tipo → FALLO; campo nuevo → solo anotación);
 *   3. la latencia respeta el presupuesto (soft: se informa, no aborta).
 *
 * Se valida un sample por "shape" (tipo de contenido / query), para cubrir MOV/SER/LSR/… con una
 * sola prueba. La captura se lee DENTRO del test (no al coleccionar), porque la genera la
 * dependencia `live-capture`, que corre después de la colección. Si la app no llamó al endpoint
 * durante el recorrido, el test se omite indicando qué journey ampliar en journeys.ts.
 */
import { endpointSlug, SESSION_ENDPOINTS } from '../catalog/endpoint-id';
import { env } from '../config/env';
import { loadContract, loadOverrides } from '../contracts/registry';
import { validate } from '../contracts/shape';
import { loadLiveCapture, liveSamples } from './live-capture';
import { expect, test } from './fixtures';

export interface ContractTestOptions {
  smoke?: boolean;
  maxSamples?: number;
  version?: string;
  /** Clave del Test Case en Jira (MULTISTC-…); se antepone al nombre del test. */
  tc?: string;
  /**
   * Variante del endpoint cuya respuesta tiene otra forma (p. ej. `unified-detailed/RSR…` devuelve
   * un árbol de grabaciones, no una ficha de contenido). Se validan solo los samples cuya shape
   * cumpla `shapes`, contra el contrato `<slug>~<name>.json`.
   */
  variant?: { name: string; shapes: RegExp };
  /** Shapes que este test NO valida porque las cubre una variante. */
  excludeShapes?: RegExp;
}

/** Id de contrato de una variante: `GET nsh/unified-detailed/{pid}~RSR`. */
export function variantContractId(id: string, variant?: { name: string }): string {
  return variant ? `${id}~${variant.name}` : id;
}

/** Nº máximo de shapes distintas que se validan por endpoint. */
const MAX_DISTINCT_SHAPES = 8;

export function defineContractTest(id: string, opts: ContractTestOptions = {}): void {
  const version = opts.version ?? env.appVersion;
  const tags = ['@contract', `@${endpointSlug(id)}`, ...(opts.smoke ? ['@smoke'] : [])];
  const method = id.split(' ')[0]!;
  const title = `${opts.tc ? `[${opts.tc}] ` : ''}contrato ${id}${opts.variant ? ` (${opts.variant.name})` : ''}`;

  // Versión del contrato contra la que validar: por defecto la propia, o la indicada en
  // CONTRACT_BASELINE para comprobar que una versión nueva no rompe el contrato de la anterior.
  const contractVersion = env.contractBaseline || version;

  test(title, { tag: tags }, async ({}, testInfo) => {
    test.skip(SESSION_ENDPOINTS.has(id), `${id} cambia la sesión (perfil activo, tokens): no se valida.`);

    const override = loadOverrides()[variantContractId(id, opts.variant)] ?? {};
    const capture = loadLiveCapture(version);
    test.skip(!capture, `No hay captura en vivo para ${version}: ejecuta "npm run test:api" (genera la captura) o "npm run live".`);

    const samples = liveSamples(capture, id)
      .filter((s) => (opts.variant ? opts.variant.shapes.test(s.shape) : !opts.excludeShapes?.test(s.shape)))
      .slice(0, Math.max(opts.maxSamples ?? MAX_DISTINCT_SHAPES, 1));
    test.skip(!samples.length, `La web no llamó a ${id} durante el recorrido. Amplía una journey en src/recordings/journeys.ts para cubrirlo.`);

    if (contractVersion !== version) {
      testInfo.annotations.push({ type: 'baseline', description: `captura ${version} validada contra contrato ${contractVersion}` });
    }
    const shape = loadContract(variantContractId(id, opts.variant), contractVersion);
    const budget = override.latencyBudgetMs ?? env.latencyBudgetMs;

    for (const sample of samples) {
      await test.step(sample.key, async () => {
        testInfo.annotations.push({ type: 'captured-in', description: `${sample.journey}` });

        expect(sample.status, `${method} ${sample.url} → ${sample.status}`).toBeGreaterThanOrEqual(200);
        expect(sample.status, `${method} ${sample.url} → ${sample.status}`).toBeLessThan(300);

        if (!override.skipContract && sample.isJson) {
          expect(shape, `falta el contrato de ${id}: ejecuta "npm run contracts:build"`).not.toBeNull();
          expect(sample.body, 'la respuesta no es JSON').not.toBeNull();
          const violations = validate(sample.body, shape!, override.optional ?? []);
          const added = violations.filter((v) => v.kind === 'added');
          const breaking = violations.filter((v) => v.kind !== 'added');
          if (added.length) {
            testInfo.annotations.push({ type: 'contract-added-fields', description: added.map((v) => v.path).slice(0, 30).join(', ') });
          }
          await testInfo.attach(`contract-violations-${endpointSlug(sample.shape)}.json`, { contentType: 'application/json', body: JSON.stringify(violations, null, 2) });
          expect(breaking, `cambios que rompen el contrato de ${contractVersion}:\n${breaking.map((v) => `  ${v.kind} ${v.path} (esperado ${v.expected ?? '-'}, obtenido ${v.actual ?? 'ausente'})`).join('\n')}`).toEqual([]);
        }

        // Latencia: solo informativa. El tiempo se mide en el navegador durante la carga completa de
        // la pantalla, con muchas peticiones en paralelo compitiendo, así que no es una latencia de
        // API limpia y haría fallar por contención, no por lentitud real del BFF. Se anota la que
        // supere el presupuesto para poder vigilarla sin falsos positivos.
        if (sample.durationMs !== undefined && sample.durationMs > budget) {
          testInfo.annotations.push({ type: 'slow', description: `${sample.key}: ${sample.durationMs} ms > ${budget} ms (medido en carga de página)` });
        }
      });
    }
  });
}
