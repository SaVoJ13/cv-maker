import { PASS_DURATION_MS } from '../domain/access';
import type { BillingPort } from './billing';

/**
 * ЗАГЛУШКА BILLING — ТІЛЬКИ ДЛЯ РОЗРОБКИ (npm run dev і збірка --mode dev). Нічого не купує й нічого не
 * списує: одразу видає Pass на 30 днів. Не потрапляє в closed і prod (import під умовою режиму;
 * check:prod шукає знак нижче).
 */
export const STUB_BILLING_MARKER = 'CVMAKER_STUB_BILLING_DEV_ONLY';

export function createStubBilling(now: () => number = Date.now, delayMs = 800): BillingPort {
  return {
    price: async () => '9,99 zł',
    async buyPass() {
      await new Promise<void>((r) => setTimeout(r, delayMs));
      return { until: now() + PASS_DURATION_MS };
    },
  };
}
