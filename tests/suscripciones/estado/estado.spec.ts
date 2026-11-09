/**
 * Negocio (GO-36315 · Rent & Subscription flows: ficha del paquete, `GET nsh/subscription/{pid}`).
 * - `image` es el Banner y `logo.image` el Icon (MULTISTC-68315); trae la metadata del paquete (68314).
 * - `bars` señala exactamente un estado y nunca `isActivationWarningVisible` (68316–68321).
 * - `buttons` sigue la tabla de decisión del estado (68322) y Términos y condiciones solo con `services` (68323).
 * - `services`, si viene, no está vacío (68324).
 * - Un paquete que aparece en "contratados" no puede salir como NO contratado.
 */
import { expect, test } from '../../../src/testing/fixtures';
import { fromLive } from '../../../src/testing/live-capture';

type Flags = Record<string, unknown>;
interface SubDetail {
  pid?: string;
  title?: unknown;
  image?: { type?: unknown; url?: unknown };
  logo?: { image?: { type?: unknown; url?: unknown } };
  bars?: Flags;
  buttons?: Flags;
  services?: unknown;
}
const STATES = ['isNotSubscribed', 'isActivatedVisible', 'isActivatedPendingVisible', 'isCancellationPendingVisible'];

test('[MULTISTC-76683] la ficha del paquete calcula estado, barras y botones de forma coherente', { tag: ['@business'] }, async ({}, testInfo) => {
  const { captured, samples } = fromLive('GET nsh/subscription/{pid}');
  test.skip(!captured, 'No hay captura en vivo: ejecuta "npm run test:api".');
  test.skip(!samples.length, 'La web no abrió la ficha de ningún paquete (journey subscription-detail).');
  const purchased = ((fromLive('GET nsh/subscriptions/purchased').samples[0]?.body as { purchased?: { pid: string }[] })?.purchased ?? []).map((s) => s.pid);

  for (const s of samples) {
    const d = s.body as SubDetail;
    const bars = d.bars ?? {};
    const btn = d.buttons ?? {};
    const on = STATES.filter((k) => bars[k] === true);
    testInfo.annotations.push({ type: d.pid ?? s.key, description: `estado: ${on.join('+') || 'ninguno'} · botones: ${Object.keys(btn).filter((k) => btn[k] === true).join(', ') || '—'}` });

    expect.soft(typeof d.title === 'string' && d.title !== '', `${d.pid}: title`).toBe(true);
    expect.soft(d.image?.type, `${d.pid}: image es el Banner`).toBe('Banner');
    expect.soft(d.logo?.image?.type, `${d.pid}: logo es el Icon`).toBe('Icon');

    expect.soft(on.length, `${d.pid}: un único estado en bars`).toBe(1);
    expect.soft('isActivationWarningVisible' in bars, `${d.pid}: bars no debe traer isActivationWarningVisible`).toBe(false);

    const hasServices = Array.isArray(d.services) && d.services.length > 0;
    if ('services' in d) expect.soft(hasServices, `${d.pid}: services vacío (debe omitirse)`).toBe(true);
    if (btn.isTermsAndConditionsVisible === true) expect.soft(hasServices, `${d.pid}: T&C visible sin services`).toBe(true);

    if (bars.isNotSubscribed === true) {
      expect.soft(btn.isAddSubscriptionVisible, `${d.pid} NO_CONTRATADA: añadir`).toBe(true);
      expect.soft(btn.isCancelSubscriptionVisible, `${d.pid} NO_CONTRATADA: cancelar`).toBe(false);
      expect.soft(btn.isMoreDetailVisible, `${d.pid} NO_CONTRATADA: más detalle`).toBe(false);
      expect.soft(btn.isTermsAndConditionsVisible, `${d.pid} NO_CONTRATADA: T&C`).toBe(false);
      expect.soft(purchased.includes(d.pid!), `${d.pid}: aparece como contratado en Ajustes pero la ficha dice NO_CONTRATADA`).toBe(false);
    }
    if (bars.isActivatedPendingVisible === true) {
      expect.soft(btn.isAddSubscriptionVisible, `${d.pid} EN_PROCESO_DE_CONTRATACION: añadir`).toBe(false);
      expect.soft(btn.isCancelSubscriptionVisible, `${d.pid} EN_PROCESO_DE_CONTRATACION: cancelar`).toBe(false);
      expect.soft(btn.isMoreDetailVisible, `${d.pid} EN_PROCESO_DE_CONTRATACION: más detalle`).toBe(true);
    }
    if (bars.isActivatedVisible === true) {
      expect.soft(btn.isAddSubscriptionVisible, `${d.pid} CONTRATADA: añadir`).toBe(false);
      expect.soft(btn.isMoreDetailVisible, `${d.pid} CONTRATADA: más detalle`).toBe(false);
    }
  }
});
