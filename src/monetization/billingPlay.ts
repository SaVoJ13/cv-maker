import { errorText } from '../export/errors';

/**
 * Ядро Google Play Billing для «Pass 30 днів»: РАЗОВИЙ споживаний продукт (INAPP), без автоматичного поновлення.
 * Модуль не імпортує Capacitor і не читає import.meta.env: плагін подається ззовні (див. billing.ts),
 * тому логіку можна перевіряти тестами з мок-плагіном.
 *
 * ПОРЯДОК (важливо, перевірено за вихідним кодом @capgo/native-purchases 8.9.6):
 *  - `purchaseProduct({ isConsumable: true })` за замовчуванням ЗАПУСКАЄ consume ще ДО того, як повернути результат
 *    у JS. Якщо застосунок помре між consume і записом `passUntil`, оплата втрачена (токен спожито, права немає).
 *  - Тому передаємо `autoAcknowledgePurchases: false`: плагін нічого не споживає, лише повертає токен.
 *  - Ми спершу видаємо право й ЗБЕРІГАЄМО його (redeem пише в сховище синхронно), і лише потім викликаємо
 *    `consumePurchase`. Якщо consume не вдався або застосунок закрився, покупка лишається в getPurchases
 *    як PURCHASED: при наступному старті/експорті restore() побачить її в журналі, не видасть Pass вдруге
 *    й спробує спожити знову. Споживання (acknowledge) має відбутись протягом 3 діб, інакше Google поверне кошти.
 */

/** Результат спроби купити. Pending (відкладений платіж) Pass НЕ видає; скасування не є помилкою. */
export type BuyResult = 'granted' | 'cancelled' | 'pending' | 'error';

/**
 * Видати право за покупку. Отримує всі ідентифікатори покупки (purchaseToken, orderId).
 * Має синхронно змінити й зберегти стан; повертає true, якщо Pass видано зараз, і false,
 * якщо цю покупку вже враховано раніше.
 */
export type Redeem = (ids: string[]) => boolean;

export interface PassProduct {
  /** Локалізована ціна з відповіді Google, наприклад «9,99 zł» */
  price: string;
  title: string;
}

export interface BillingPort {
  /** Назва й ціна з Google Play; null, якщо купівля недоступна. */
  product(): Promise<PassProduct | null>;
  buy(redeem: Redeem): Promise<BuyResult>;
  /** Підбирає незавершені покупки Pass. Повертає, скільки разів Pass видано зараз (0 = нічого нового). */
  restore(redeem: Redeem): Promise<number>;
}

export class BillingError extends Error {
  constructor(
    readonly stage: 'support' | 'product' | 'purchase' | 'consume' | 'restore',
    cause: unknown,
  ) {
    super(`${stage}: ${errorText(cause)}`);
    this.name = 'BillingError';
  }
}

/** Підмножина відповіді плагіна @capgo/native-purchases, яка тут потрібна. */
export interface PlayTransaction {
  productIdentifier?: string | null;
  purchaseToken?: string | null;
  transactionId?: string | null;
  orderId?: string | null;
  /** Android: "1" = PURCHASED, "2" = PENDING */
  purchaseState?: string | null;
}

/** Підмножина плагіна, яка тут потрібна (реальний плагін їй відповідає). */
export interface PurchasesPlugin {
  isBillingSupported(): Promise<{ isBillingSupported: boolean }>;
  getProduct(o: { productIdentifier: string; productType: 'inapp' }): Promise<{ product: { title: string; priceString: string } }>;
  purchaseProduct(o: {
    productIdentifier: string;
    productType: 'inapp';
    isConsumable: boolean;
    autoAcknowledgePurchases: boolean;
  }): Promise<PlayTransaction>;
  getPurchases(o: { productType: 'inapp' }): Promise<{ purchases: PlayTransaction[] }>;
  consumePurchase(o: { purchaseToken: string }): Promise<void>;
}

const PURCHASED = '1';
const PENDING = '2';

/** Ідентифікатори покупки для журналу (токен — головний, orderId — додатковий). */
function idsOf(tx: PlayTransaction): string[] {
  return [tx.purchaseToken, tx.orderId].filter((x): x is string => typeof x === 'string' && x !== '');
}

/** Код або текст помилки плагіна: Android повертає назву коду Billing (USER_CANCELED, ITEM_ALREADY_OWNED…) у `code`. */
function failureInfo(e: unknown): { code: string; message: string } {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { code?: unknown; message?: unknown };
  return { code: typeof o.code === 'string' ? o.code : '', message: typeof o.message === 'string' ? o.message : errorText(e) };
}

export function createPlayBilling(plugin: PurchasesPlugin, productId: string): BillingPort {
  const consume = async (tx: PlayTransaction): Promise<void> => {
    if (!tx.purchaseToken) return;
    try {
      await plugin.consumePurchase({ purchaseToken: tx.purchaseToken });
    } catch (e) {
      // право вже видано й збережено; покупка лишиться незспоженою і буде спожита при наступному restore()
      console.warn(new BillingError('consume', e));
    }
  };

  const restore = async (redeem: Redeem): Promise<number> => {
    let list: PlayTransaction[];
    try {
      list = (await plugin.getPurchases({ productType: 'inapp' })).purchases;
    } catch (e) {
      throw new BillingError('restore', e);
    }
    let granted = 0;
    for (const tx of list) {
      if (tx.productIdentifier !== productId || tx.purchaseState !== PURCHASED) continue; // pending не рахуємо
      const ids = idsOf(tx);
      if (ids.length === 0) continue;
      if (redeem(ids)) granted += 1;
      await consume(tx); // і нова, і вже врахована, але ще не спожита покупка
    }
    return granted;
  };

  return {
    async product() {
      try {
        if (!(await plugin.isBillingSupported()).isBillingSupported) return null;
      } catch (e) {
        throw new BillingError('support', e);
      }
      try {
        const { product } = await plugin.getProduct({ productIdentifier: productId, productType: 'inapp' });
        return product.priceString ? { price: product.priceString, title: product.title } : null;
      } catch (e) {
        throw new BillingError('product', e);
      }
    },

    async buy(redeem) {
      let tx: PlayTransaction;
      try {
        tx = await plugin.purchaseProduct({
          productIdentifier: productId,
          productType: 'inapp',
          isConsumable: true,
          autoAcknowledgePurchases: false,
        });
      } catch (e) {
        const { code, message } = failureInfo(e);
        if (code === 'USER_CANCELED') return 'cancelled';
        if (/pending/i.test(message)) return 'pending';
        if (code === 'ITEM_ALREADY_OWNED') {
          // уже куплено, але не спожито (збій попередньої спроби): забираємо через restore
          try {
            return (await restore(redeem)) > 0 ? 'granted' : 'error';
          } catch {
            return 'error';
          }
        }
        console.error(new BillingError('purchase', e));
        return 'error';
      }
      const state = tx.purchaseState;
      if (state != null && state !== PURCHASED) return state === PENDING ? 'pending' : 'error';
      const ids = idsOf(tx);
      if (ids.length === 0 || (tx.productIdentifier != null && tx.productIdentifier !== productId)) {
        console.error(new BillingError('purchase', 'порожній purchaseToken або чужий productIdentifier'));
        return 'error';
      }
      redeem(ids); // спершу право й запис у сховище…
      await consume(tx); // …і лише потім споживання токена
      return 'granted';
    },

    restore,
  };
}
