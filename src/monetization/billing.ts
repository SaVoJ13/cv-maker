import { PASS_DURATION_MS } from '../domain/access';

/**
 * Покупка Pass 30 днів. Мережеві виклики лише тут (monetization/), не в domain.
 * Крок 5a: лише заглушка розробника; справжній Google Play Billing — крок 5b.
 */
export interface BillingPort {
  /** Ціна з магазину (наприклад «9,99 zł»), або null, якщо недоступна */
  price(): Promise<string | null>;
  /** Купує Pass; повертає момент завершення (мс). Відхиляється, якщо покупку скасовано чи не вдалась. */
  buyPass(): Promise<{ until: number }>;
}

export class BillingUnavailable extends Error {
  constructor() {
    super('billing unavailable');
    this.name = 'BillingUnavailable';
  }
}

/** Покупка недоступна (збірка без заглушки й без Google Play Billing). */
const unavailable: BillingPort = {
  price: () => Promise.resolve(null),
  buyPass: () => Promise.reject(new BillingUnavailable()),
};

/** Заглушка billing дозволена лише в розробці (npm run dev і збірка --mode dev). У closed і prod її немає. */
export function isStubBilling(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'dev';
}

export function getBilling(): BillingPort {
  if (import.meta.env.DEV || import.meta.env.MODE === 'dev') {
    let inner: Promise<BillingPort> | null = null;
    const get = () => (inner ??= import('./billingStub').then((m) => m.createStubBilling()));
    return { price: async () => (await get()).price(), buyPass: async () => (await get()).buyPass() };
  }
  return unavailable;
}

export { PASS_DURATION_MS };
