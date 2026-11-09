/**
 * Mutación (GO-36303 · Recordings: seasons): grabar una SERIE entera y cancelarla entera.
 * Cubre MULTISTC-67784 (agendar serie: entireSeries=true, entireSeason=false) y MULTISTC-67787
 * (cancelar vía pid de la RSR). Patrón hacer → verificar → deshacer, moviendo la UI (la app firma):
 *   0. foto ANTES de nsh/recordings: pids y recordingSeriesPid de lo agendado,
 *   1. abre una ficha de directo seriada que se pueda grabar y SIN grabación previa,
 *   2. pulsa "Aufnehmen" → "Serie aufnehmen" y captura `POST nsh/recordings` (entireSeries=true),
 *   3. verifica que aparece una RSR nueva con sus REC (isEntireSeries=true),
 *   4. DESHACE: cancela la serie desde la misma ficha y verifica que no queda ningún REC de esa RSR.
 *      Si el cancelado falla, la prueba falla y lista lo que quedó (limpieza manual en Mein TV).
 *
 * La temporada (67776, 67779) no se puede probar desde la web DE: el KV ALLOWED_RECORDING_LEVELS
 * tiene season=false y la ficha no ofrece "Staffel aufnehmen".
 * Seguridad: nunca toca una ficha que ya se estaba grabando. Apagada salvo API_ALLOW_MUTATIONS=true.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../src/testing/fixtures';
import { env } from '../../../src/config/env';
import { goToApp, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, readCanoway } from '../../../src/testing/mutation';

const LIST_PATH = /\/nsh\/recordings(\?|$)/;
const RECORD_BTN = /aufnehmen|aufnahme starten/i;
const CANCEL_BTN = /aufnahme (löschen|abbrechen|stoppen|beenden)|nicht (mehr )?aufnehmen|serie abbrechen/i;
const SERIES_CHOICE = /^serie aufnehmen$/i;
const SERIES_CANCEL = /serie/i;

type Rec = { pid?: string; recordingSeriesPid?: string; isEntireSeries?: boolean };
type RecList = { recordings?: { scheduled?: Rec[]; ongoing?: Rec[] } } | null;

async function scheduled(page: Page): Promise<Rec[]> {
  const hit = await readCanoway(page, { pathRe: LIST_PATH, navigate: () => goToApp(page, '/my-tv'), timeout: 30_000 });
  expect(hit.status, `nsh/recordings devolvió ${hit.status}`).toBeLessThan(300);
  const body = hit.json as RecList;
  return [...(body?.recordings?.scheduled ?? []), ...(body?.recordings?.ongoing ?? [])];
}

const visible = (l: Locator, timeout = 5000) => l.waitFor({ state: 'visible', timeout }).then(() => true, () => false);

test.describe('[MULTISTC-76698] grabación de serie: agendar y cancelar', { tag: ['@mutation', '@recordings'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');

  test('agenda una serie entera y la cancela', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    // 0. Foto ANTES.
    const before = await scheduled(page);
    const seriesBefore = new Set(before.map((r) => r.recordingSeriesPid).filter(Boolean));
    testInfo.annotations.push({ type: 'recordings-before', description: `${before.length} REC, ${seriesBefore.size} series` });

    // 1. Ficha de directo seriada, grabable y sin grabación previa.
    await goToApp(page, '/tv-guide/now');
    await settle(page, 2000);
    const links = page.locator('a[href*="/details/live-serie/"]');
    await links.first().waitFor({ state: 'visible', timeout: 20_000 });
    const hrefs = [...new Set((await links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))).filter(Boolean))].slice(0, 10);

    let detailHref: string | null = null;
    let recordBtn: Locator | null = null;
    for (const href of hrefs) {
      await goToApp(page, href);
      await settle(page, 1500);
      const rec = page.getByRole('button', { name: RECORD_BTN }).first();
      const already = await visible(page.getByRole('button', { name: CANCEL_BTN }).first(), 2000);
      if (!already && (await visible(rec, 4000))) {
        detailHref = href;
        recordBtn = rec;
        break;
      }
    }
    test.skip(!detailHref || !recordBtn, 'Ninguna serie en directo grabable y sin grabación previa en "Jetzt".');
    testInfo.annotations.push({ type: 'detail', description: detailHref! });

    // 2. HACER: agendar la serie.
    let newSeries: string[] = [];
    let scheduledOk = false;
    try {
      const hit = await awaitCanoway(page, {
        method: 'POST',
        pathRe: LIST_PATH,
        timeout: 25_000,
        trigger: async () => {
          await recordBtn!.click();
          const series = page.getByRole('button', { name: SERIES_CHOICE }).first();
          if (!(await visible(series, 4000))) throw new Error('El diálogo no ofrece "Serie aufnehmen" (¿contenido no seriado?)');
          await series.click();
        },
      });
      testInfo.annotations.push({ type: 'schedule', description: `POST ${new URL(hit.url).pathname} → ${hit.status}` });
      scheduledOk = hit.status < 400;
      const err = (hit.json as { errors?: { errorMessage?: string }[] } | null)?.errors?.[0];
      if (hit.status === 420 && err?.errorMessage === 'RecordingSubscriberQuotaExceeded') {
        test.skip(true, 'Cuenta sin espacio de grabación (420 RecordingSubscriberQuotaExceeded). Liberar espacio en Mein TV y relanzar.');
      }
      expect(hit.status, `agendar serie devolvió ${hit.status}`).toBeLessThan(300);

      // 3. VERIFICAR: una RSR nueva, con sus REC marcados como serie entera.
      const after = await scheduled(page);
      newSeries = [...new Set(after.map((r) => r.recordingSeriesPid).filter((p): p is string => !!p && !seriesBefore.has(p)))];
      const recs = after.filter((r) => r.recordingSeriesPid && newSeries.includes(r.recordingSeriesPid));
      testInfo.annotations.push({ type: 'created', description: `${newSeries.join(', ') || '(ninguna)'} · ${recs.length} REC` });
      expect(newSeries.length, 'tras agendar la serie no aparece ninguna RSR nueva en nsh/recordings').toBe(1);
      expect.soft(recs.length, 'la serie agendada no tiene ningún REC').toBeGreaterThan(0);
      expect.soft(recs.filter((r) => r.isEntireSeries !== true).map((r) => r.pid), 'REC de la serie sin isEntireSeries=true').toEqual([]);
    } finally {
      // 4. DESHACER: cancelar la serie entera desde la misma ficha.
      if (scheduledOk) {
        try {
          await goToApp(page, detailHref!);
          await settle(page, 2000);
          const cancel = page.getByRole('button', { name: CANCEL_BTN }).first();
          if (!(await visible(cancel, 10_000))) throw new Error(`no aparece el botón de cancelar en ${detailHref}`);
          const res = await awaitCanoway(page, {
            method: /^(DELETE|POST|PUT)$/,
            pathRe: /\/nsh\/recordings\/(RSR|REC)/i,
            timeout: 20_000,
            trigger: async () => {
              await cancel.click();
              const dialog = page.getByRole('dialog');
              if (await visible(dialog, 4000)) {
                const series = dialog.getByRole('button', { name: SERIES_CANCEL });
                if (await series.count()) await series.first().click();
                else await dialog.getByRole('button', { name: /abbrechen|löschen|bestätigen|^ja$/i }).last().click();
                // Segunda confirmación, si la hay (nunca "Zurück").
                await page.waitForTimeout(1500);
                const again = dialog.getByRole('button', { name: /^(serie|aufnahme) ?(abbrechen|löschen)$|^bestätigen$|^ja$/i });
                if ((await dialog.isVisible().catch(() => false)) && (await again.count())) await again.last().click();
              }
            },
          });
          testInfo.annotations.push({ type: 'cancel', description: `${res.method} ${new URL(res.url).pathname} → ${res.status}` });
          expect(res.status, 'el cancelado de la serie no confirmó 2xx').toBeLessThan(400);

          const final = await scheduled(page);
          const leftovers = final.filter((r) => r.recordingSeriesPid && newSeries.includes(r.recordingSeriesPid)).map((r) => r.pid);
          expect(leftovers, `quedaron REC de la serie creada por la prueba: ${leftovers.join(', ')}`).toEqual([]);
        } catch (e) {
          throw new Error(
            `TEARDOWN FALLIDO: puede quedar una serie agendada por la prueba en prod (${newSeries.join(', ') || 'RSR desconocida'}). ` +
              `Cancelarla en Mein TV > Geplante Aufnahmen > ficha de la serie.\n${String(e)}`,
          );
        }
      }
    }
  });
});
