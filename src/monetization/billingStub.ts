import type { BillingPort } from './billingPlay';

/**
 * ЗАГЛУШКА BILLING — ТІЛЬКИ ДЛЯ РОЗРОБКИ (npm run dev і збірка --mode dev). Нічого не купує й нічого не
 * списує: одразу видає Pass (через той самий redeem, що й справжній Billing). Не потрапляє в closed і prod
 * (import під умовою режиму; check:prod шукає знак нижче).
 */
export const STUB_BILLING_MARKER = 'CVMAKER_STUB_BILLING_DEV_ONLY';

export function createStubBilling(now: () => number = Date.now, delayMs = 800): BillingPort {
  let n = 0;
  return {
    product: async () => ({ price: '9,99 zł', title: 'Pass 30 dni' }),
    async buy(redeem) {
      await new Promise<void>((r) => setTimeout(r, delayMs));
      redeem([`stub-${now()}-${n++}`]);
      return 'granted';
    },
    restore: async () => 0,
  };
}
