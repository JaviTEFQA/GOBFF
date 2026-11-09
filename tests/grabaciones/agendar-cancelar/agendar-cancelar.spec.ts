/**
 * Mutación (GO-37531): agendar una grabación y cancelarla.
 * Patrón hacer → verificar → deshacer, contra el BFF real, moviendo la UI (la app firma la llamada):
 *   0. foto ANTES: pids de nsh/recordings (scheduled + ongoing),
 *   1. abre una ficha de directo que se pueda grabar y que NO tenga ya una grabación,
 *   2. pulsa "Aufnehmen" y captura la llamada de agendado,
 *   3. verifica que en nsh/recordings aparece un pid NUEVO respecto a la foto,
 *   4. DESHACE: cancela desde la ficha de la grabación creada y verifica que los pids nuevos desaparecen.
 *      Si el cancelado falla, la prueba falla y lista los pids que quedaron (limpieza manual).
 *
 * Seguridad: nunca pulsa un botón de cancelar en una ficha que ya estaba grabándose (no toca las
 * grabaciones existentes de la cuenta); si no llegó a agendar, no intenta deshacer nada.
 * Apagada salvo API_ALLOW_MUTATIONS=true. Primera ejecución con navegador visible.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../../../src/testing/fixtures';
import { env } from '../../../src/config/env';
import { goToApp, settle } from '../../../src/recordings/journeys';
import { awaitCanoway, readCanoway } from '../../../src/testing/mutation';

const WRITE = /^(POST|PUT|DELETE|PATCH)$/;
const RECORDING_PATH = /record/i;
const LIST_PATH = /\/nsh\/recordings(\?|$)/;

const RECORD_BTN = /aufnehmen|aufnahme starten/i;
const CANCEL_BTN = /aufnahme (löschen|abbrechen|stoppen|beenden)|nicht (mehr )?aufnehmen|löschen/i;
/**
 * Diálogo "Wähle eine Aufnahme-Option aus": [Episode aufnehmen] [Serie aufnehmen]. Siempre solo la
 * emisión (nunca la serie: crearía muchas grabaciones).
 */
const SINGLE_CHOICE = /^episode aufnehmen$|(nur )?(diese|einzelne) (folge|sendung)|^folge aufnehmen$/i;
/**
 * Confirmación al cancelar: diálogo "Möchtest du diese Aufnahme abbrechen?" con [Zurück] y
 * [Aufnahme abbrechen]. Se busca DENTRO del diálogo: fuera hay otro botón con el mismo nombre
 * (el de la ficha) tapado por el backdrop. Nunca opciones de "Serie".
 */
const CONFIRM = /^(?!.*serie).*(aufnahme abbrechen|aufnahme löschen|episode löschen|löschen|bestätigen|ja)$/i;

type Rec = { pid?: string; recordingSeriesPid?: string; isEntireSeries?: boolean };
type RecList = { recordings?: { scheduled?: Rec[]; ongoing?: Rec[] } } | null;

/** Series agendadas que ya existían antes de la prueba: la plataforma les añade episodios sola. */
let seriesBefore = new Set<string>();

async function recordingPids(page: Page, navigate: () => Promise<void>): Promise<Set<string>> {
  const hit = await readCanoway(page, { pathRe: LIST_PATH, navigate, timeout: 30_000 });
  expect(hit.status, `nsh/recordings devolvió ${hit.status}`).toBeLessThan(300);
  const body = hit.json as RecList;
  const all = [...(body?.recordings?.scheduled ?? []), ...(body?.recordings?.ongoing ?? [])];
  // Episodios que las series previas añaden solas mientras corre la prueba: no son de la prueba.
  const own = all.filter((r) => !(r.isEntireSeries && r.recordingSeriesPid && seriesBefore.has(r.recordingSeriesPid)));
  return new Set(own.map((r) => r.pid).filter((p): p is string => !!p));
}

const visible = (l: Locator, timeout = 5000) => l.waitFor({ state: 'visible', timeout }).then(() => true, () => false);

test.describe('[MULTISTC-76659] grabación: agendar y cancelar', { tag: ['@mutation', '@recordings'] }, () => {
  test.skip(!env.allowMutations, 'Mutación: ejecuta con API_ALLOW_MUTATIONS=true (proyecto mutations).');

  test('agenda una grabación y la cancela', async ({ page }, testInfo) => {
    // 0. Foto ANTES.
    seriesBefore = new Set();
    const first = await readCanoway(page, { pathRe: LIST_PATH, navigate: () => goToApp(page, '/my-tv'), timeout: 30_000 });
    const firstBody = first.json as RecList;
    seriesBefore = new Set([...(firstBody?.recordings?.scheduled ?? []), ...(firstBody?.recordings?.ongoing ?? [])].filter((r) => r.isEntireSeries && r.recordingSeriesPid).map((r) => r.recordingSeriesPid!));
    const before = await recordingPids(page, () => goToApp(page, '/my-tv'));
    testInfo.annotations.push({ type: 'recordings-before', description: String(before.size) });

    // 1. Buscar una ficha de directo grabable y SIN grabación previa (navegación por clic: sin recargas).
    await goToApp(page, '/tv-guide/now');
    await settle(page, 2000);
    const links = page.locator('a[href*="/details/live"]');
    await links.first().waitFor({ state: 'visible', timeout: 20_000 });
    const hrefs = [...new Set((await links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))).filter(Boolean))].slice(0, 8);

    let detailHref: string | null = null;
    let recordBtn: Locator | null = null;
    for (const href of hrefs) {
      await goToApp(page, href);
      await settle(page, 1500);
      const rec = page.getByRole('button', { name: RECORD_BTN }).first();
      const alreadyRecording = await visible(page.getByRole('button', { name: CANCEL_BTN }).first(), 2000);
      if (!alreadyRecording && (await visible(rec, 4000))) {
        detailHref = href;
        recordBtn = rec;
        break;
      }
      await goToApp(page, '/tv-guide/now');
      await settle(page, 1000);
    }
    test.skip(!detailHref || !recordBtn, 'Ningún directo grabable sin grabación previa en "Jetzt" ahora mismo.');
    testInfo.annotations.push({ type: 'detail', description: detailHref! });

    // 2. HACER: agendar.
    let scheduled = false;
    let created: string[] = [];
    try {
      const hit = await awaitCanoway(page, {
        method: WRITE,
        pathRe: RECORDING_PATH,
        timeout: 25_000,
        trigger: async () => {
          await recordBtn!.click();
          const single = page.getByRole('button', { name: SINGLE_CHOICE }).first();
          if (await visible(single, 3000)) await single.click();
        },
      });
      testInfo.annotations.push({ type: 'schedule', description: `${hit.method} ${new URL(hit.url).pathname} → ${hit.status}` });
      scheduled = hit.status < 400; // a partir de aquí hay algo que deshacer
      // Cuota llena: el BFF rechaza bien (420 / 230118 RecordingSubscriberQuotaExceeded). No es un
      // fallo del BFF sino una precondición no cumplida (cuenta sin espacio): se omite y se explica.
      const err = (hit.json as { errors?: { errorCode?: number; errorMessage?: string }[] } | null)?.errors?.[0];
      if (hit.status === 420 && err?.errorMessage === 'RecordingSubscriberQuotaExceeded') {
        testInfo.annotations.push({ type: 'precondition', description: 'Cuenta sin espacio de grabación (over-quota): liberar espacio en Mein TV.' });
        test.skip(true, 'Cuenta sin espacio de grabación (420 RecordingSubscriberQuotaExceeded). Liberar espacio en Mein TV y relanzar.');
      }
      expect(hit.status, `agendar devolvió ${hit.status}`).toBeLessThan(300);

      // 3. VERIFICAR: aparece un pid nuevo.
      const after = await recordingPids(page, () => goToApp(page, '/my-tv'));
      created = [...after].filter((p) => !before.has(p));
      testInfo.annotations.push({ type: 'created', description: created.join(', ') || '(ninguno)' });
      expect(created.length, 'tras agendar no aparece ninguna grabación nueva en nsh/recordings').toBeGreaterThan(0);
    } finally {
      // 4. DESHACER (solo si se llegó a agendar).
      if (scheduled) {
        try {
          // Se cancela desde la ficha de la propia grabación (/details/recording/…-REC…): ofrece
          // "Aufnahme abbrechen" tanto si está programada como si ya está en curso (un directo que se
          // emite ahora empieza a grabarse al momento y la ficha del directo deja de ofrecer cancelar).
          const own = created[0];
          const target = own ? `/details/recording/aufnahme-${own}` : detailHref!;
          await goToApp(page, '/my-tv');
          await settle(page, 1000);
          await goToApp(page, target);
          await settle(page, 2000);
          const cancel = page.getByRole('button', { name: CANCEL_BTN }).first();
          if (!(await visible(cancel, 10_000))) throw new Error(`no aparece el botón de cancelar en ${target}`);
          const res = await awaitCanoway(page, {
            method: /^(DELETE|POST|PUT)$/,
            pathRe: /\/nsh\/recordings\/REC/i, // DELETE nsh/recordings/{pid}
            timeout: 20_000,
            trigger: async () => {
              await cancel.click();
              const dialog = page.getByRole('dialog');
              if (await visible(dialog, 4000)) await dialog.getByRole('button', { name: CONFIRM }).last().click();
            },
          });
          testInfo.annotations.push({ type: 'cancel', description: `${res.method} ${new URL(res.url).pathname} → ${res.status}` });
          expect(res.status, 'el cancelado no confirmó 2xx').toBeLessThan(400);

          const final = await recordingPids(page, () => goToApp(page, '/my-tv'));
          const leftovers = [...final].filter((p) => !before.has(p));
          expect(leftovers, `quedaron grabaciones creadas por la prueba: ${leftovers.join(', ')}`).toEqual([]);
        } catch (e) {
          throw new Error(
            `TEARDOWN FALLIDO: puede quedar una grabación creada por la prueba en prod (pids nuevos: ${created.join(', ') || 'desconocidos'}). ` +
              `Cancelarla en Mein TV > ficha de la grabación > "Aufnahme abbrechen".\n${String(e)}`,
          );
        }
      }
    }
  });
});
