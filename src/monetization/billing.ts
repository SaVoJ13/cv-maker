import { Capacitor } from '@capacitor/core';
import { MONETIZATION } from './config';
import { createPlayBilling, type BillingPort, type PurchasesPlugin } from './billingPlay';

export { BillingError, type BillingPort, type BuyResult, type PassProduct, type Redeem } from './billingPlay';

/** Заглушка billing дозволена лише в розробці (npm run dev і збірка --mode dev). У closed і prod її немає. */
export function isStubBilling(): boolean {
  return import.meta.env.DEV || import.meta.env.MODE === 'dev';
}

/** Справжній Google Play Billing: лише нативний Android (збірки closed і production). У вебі його немає. */
function isPlayBilling(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Чи може ця збірка пропонувати Pass: синхронна перевірка платформи (dev із заглушкою або Android).
 * Остаточно вирішує завантаження продукту з Google Play (`port.product()`): якщо воно не вдалось
 * (немає Play, продукту немає в Console), вікно експорту лишається в режимі «лише реклами».
 * У вебі й у збірці без Billing: false, поведінка без змін.
 */
export function billingAvailable(): boolean {
  return isStubBilling() || isPlayBilling();
}

/** Ліниво створений порт: плагін Capacitor вантажиться лише на Android і лише при першому зверненні. */
function lazy(make: () => Promise<BillingPort>): BillingPort {
  let inner: Promise<BillingPort> | null = null;
  const get = () => (inner ??= make());
  return { product: async () => (await get()).product(), buy: async (r) => (await get()).buy(r), restore: async (r) => (await get()).restore(r) };
}

let port: BillingPort | null = null;

export function getBilling(): BillingPort {
  if (port) return port;
  // умова записана прямо тут, щоб збірник відкинув import заглушки в closed і production
  if (import.meta.env.DEV || import.meta.env.MODE === 'dev') {
    port = lazy(() => import('./billingStub').then((m) => m.createStubBilling()));
  } else if (isPlayBilling()) {
    port = lazy(() =>
      import('@capgo/native-purchases').then((m) => createPlayBilling(m.NativePurchases as unknown as PurchasesPlugin, MONETIZATION.passProductId)),
    );
  } else {
    port = { product: () => Promise.resolve(null), buy: () => Promise.resolve('error'), restore: () => Promise.resolve(0) };
  }
  return port;
}
