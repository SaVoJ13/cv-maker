import test from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, FREE_ACCESS, MAX_GRANTED_IDS, canExport, formatPassDate, grantPass, normalizeAccess, passActive, touch, type AccessState } from '../src/domain/access.ts';
import { BillingError, createPlayBilling, type PlayTransaction, type PurchasesPlugin } from '../src/monetization/billingPlay.ts';

const T = 1_700_000_000_000;
const ON = { gatingEnabled: true };

/* ---------- домен: grantPass ---------- */

test('grantPass: видає Pass на 30 діб від now, оновлює lastSeen, пише ідентифікатори', () => {
  const s = grantPass(FREE_ACCESS, T, 30, ['tokA', 'ord1']);
  assert.equal(s.passUntil, T + 30 * DAY_MS);
  assert.equal(s.lastSeen, T);
  assert.deepEqual(s.granted, ['tokA', 'ord1']);
  assert.equal(passActive(s, T + 29 * DAY_MS), true);
  assert.deepEqual(canExport(s, T + DAY_MS, ON), { mode: 'pass', adsRequired: 0 });
});

test('grantPass: повторна покупка ПРОДОВЖУЄ, а не скидає', () => {
  const a = grantPass(FREE_ACCESS, T, 30, ['a']);
  const b = grantPass(a, T + 10 * DAY_MS, 30, ['b']);
  assert.equal(b.passUntil, T + 60 * DAY_MS);
});

test('grantPass: прострочений Pass відраховується від now', () => {
  const a = grantPass(FREE_ACCESS, T, 30, ['a']);
  const later = T + 45 * DAY_MS;
  assert.equal(passActive(a, later), false);
  assert.equal(grantPass(a, later, 30, ['b']).passUntil, later + 30 * DAY_MS);
});

test('grantPass: відкат годинника не скорочує й не «омолоджує» Pass (ефективний now = max(now, lastSeen))', () => {
  let s = grantPass(FREE_ACCESS, T, 30, ['a']);
  s = touch(s, T + 20 * DAY_MS); // користувались 20 днів
  const r = grantPass(s, T, 30, ['b']); // годинник відкотили на початок
  assert.equal(r.passUntil, T + 60 * DAY_MS);
  assert.equal(r.lastSeen, T + 20 * DAY_MS);
  assert.equal(passActive(s, T), false, 'під час відкату Pass не діє');
  // порожній Pass і відкат: відлік від lastSeen, а не від відкоченого now
  const f = grantPass(touch(FREE_ACCESS, T + 100), T - 5 * DAY_MS, 30, ['c']);
  assert.equal(f.passUntil, T + 100 + 30 * DAY_MS);
});

test('grantPass: та сама покупка (token або orderId) вдруге нічого не міняє', () => {
  const a = grantPass(FREE_ACCESS, T, 30, ['tok', 'ord']);
  assert.equal(grantPass(a, T + DAY_MS, 30, ['tok']), a);
  assert.equal(grantPass(a, T + DAY_MS, 30, ['інший', 'ord']), a);
  assert.equal(grantPass(a, T + DAY_MS, 30, ['tok', 'ord']).passUntil, a.passUntil);
});

test('grantPass: журнал обмежений MAX_GRANTED_IDS, найстаріші відкидаються', () => {
  let s: AccessState = FREE_ACCESS;
  for (let i = 0; i < MAX_GRANTED_IDS + 5; i++) s = grantPass(s, T, 1, [`t${i}`]);
  assert.equal(s.granted.length, MAX_GRANTED_IDS);
  assert.equal(s.granted[0], 't5');
  assert.equal(s.granted.at(-1), `t${MAX_GRANTED_IDS + 4}`);
});

test('normalizeAccess: старий v3 без granted читається, сміття в granted відкидається, нічого не падає', () => {
  const old = normalizeAccess({ v: 3, passUntil: T + 5, lastSeen: T, ad1At: null, rewardAt: null });
  assert.deepEqual(old.granted, []);
  assert.equal(old.passUntil, T + 5);
  const junk = normalizeAccess({ v: 3, passUntil: T, lastSeen: T, ad1At: null, rewardAt: null, granted: ['ok', 5, null, '', {}, 'x'.repeat(600)] });
  assert.deepEqual(junk.granted, ['ok']);
  assert.deepEqual(normalizeAccess({ v: 3, granted: 'рядок' }).granted, []);
  const many = normalizeAccess({ v: 3, granted: Array.from({ length: 100 }, (_, i) => `t${i}`) });
  assert.equal(many.granted.length, MAX_GRANTED_IDS);
});

test('formatPassDate: dd.mm.yyyy', () => {
  assert.equal(formatPassDate(new Date(2026, 0, 5, 12).getTime()), '05.01.2026');
});

/* ---------- billing з мок-плагіном ---------- */

class FakePlay implements PurchasesPlugin {
  supported = true;
  product: { title: string; priceString: string } | Error = { title: 'Pass 30 dni', priceString: '9,99 zł' };
  buyResult: PlayTransaction | Error = { productIdentifier: 'pass_30d', purchaseToken: 'tok1', orderId: 'GPA.1', purchaseState: '1' };
  owned: PlayTransaction[] = [];
  consumeFails = false;
  failGetPurchases = false;
  calls: string[] = [];
  buyArgs: unknown;
  async isBillingSupported() {
    this.calls.push('supported');
    return { isBillingSupported: this.supported };
  }
  async getProduct() {
    this.calls.push('getProduct');
    if (this.product instanceof Error) throw this.product;
    return { product: this.product };
  }
  async purchaseProduct(o: unknown) {
    this.calls.push('purchase');
    this.buyArgs = o;
    if (this.buyResult instanceof Error) throw this.buyResult;
    return this.buyResult;
  }
  async getPurchases() {
    this.calls.push('getPurchases');
    if (this.failGetPurchases) throw new Error('no play');
    return { purchases: this.owned };
  }
  async consumePurchase(o: { purchaseToken: string }) {
    this.calls.push(`consume:${o.purchaseToken}`);
    if (this.consumeFails) throw new Error('consume down');
    this.owned = this.owned.filter((p) => p.purchaseToken !== o.purchaseToken);
  }
}

/** Мінімальне «сховище»: redeem міняє стан синхронно, як useExportGate. */
function store() {
  const st = { s: FREE_ACCESS as AccessState };
  const redeem = (ids: string[]) => {
    const next = grantPass(st.s, T, 30, ids);
    const fresh = next !== st.s;
    st.s = next;
    return fresh;
  };
  return { st, redeem };
}

const err = (code: string, message: string) => Object.assign(new Error(message), { code });

/** Глушить очікувані console.error/warn на час одного тесту. */
async function quiet(fn: () => Promise<void>) {
  const e = console.error;
  const w = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.error = e;
    console.warn = w;
  }
}

test('product: ціна з відповіді Google; без підтримки Billing — null; помилка — BillingError', async () => {
  const f = new FakePlay();
  const b = createPlayBilling(f, 'pass_30d');
  assert.deepEqual(await b.product(), { price: '9,99 zł', title: 'Pass 30 dni' });
  f.supported = false;
  assert.equal(await b.product(), null);
  f.supported = true;
  f.product = new Error('Product not found');
  await assert.rejects(b.product(), (e: unknown) => e instanceof BillingError && e.stage === 'product');
});

test('buy: успіх — Pass записано ДО consume; плагін сам не споживає (autoAcknowledgePurchases:false)', async () => {
  const f = new FakePlay();
  const { st, redeem } = store();
  const seenAtRedeem: string[][] = [];
  const res = await createPlayBilling(f, 'pass_30d').buy((ids) => (seenAtRedeem.push([...f.calls]), redeem(ids)));
  assert.equal(res, 'granted');
  assert.equal(st.s.passUntil, T + 30 * DAY_MS);
  assert.deepEqual(seenAtRedeem, [['purchase']], 'на момент redeem consume ще не було');
  assert.deepEqual(f.calls, ['purchase', 'consume:tok1']);
  assert.deepEqual(f.buyArgs, { productIdentifier: 'pass_30d', productType: 'inapp', isConsumable: true, autoAcknowledgePurchases: false });
});

test('buy: скасування користувачем — cancelled, Pass не видано, consume не викликано', async () => {
  const f = new FakePlay();
  f.buyResult = err('USER_CANCELED', 'Purchase is not purchased');
  const { st, redeem } = store();
  assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'cancelled');
  assert.equal(st.s.passUntil, null);
  assert.deepEqual(f.calls, ['purchase']);
});

test('buy: pending (повідомленням або станом) — Pass НЕ видається і токен не споживається', async () => {
  const { st, redeem } = store();
  const f = new FakePlay();
  f.buyResult = new Error('Purchase is pending');
  assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'pending');
  f.buyResult = { productIdentifier: 'pass_30d', purchaseToken: 'p', purchaseState: '2' };
  assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'pending');
  assert.equal(st.s.passUntil, null);
  assert.ok(!f.calls.some((c) => c.startsWith('consume')));
});

test('buy: помилка плагіна, порожній токен чи чужий продукт — error, Pass не видано', () =>
  quiet(async () => {
    const { st, redeem } = store();
    const f = new FakePlay();
    f.buyResult = err('SERVICE_UNAVAILABLE', 'Billing service unavailable');
    assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'error');
    f.buyResult = { productIdentifier: 'pass_30d', purchaseToken: '', orderId: '', purchaseState: '1' };
    assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'error');
    f.buyResult = { productIdentifier: 'other', purchaseToken: 'x', purchaseState: '1' };
    assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'error');
    assert.equal(st.s.passUntil, null);
  }));

test('buy: consume не вдався — Pass усе одно видано й збережено', () =>
  quiet(async () => {
    const f = new FakePlay();
    f.consumeFails = true;
    const { st, redeem } = store();
    assert.equal(await createPlayBilling(f, 'pass_30d').buy(redeem), 'granted');
    assert.equal(st.s.passUntil, T + 30 * DAY_MS);
  }));

test('restore: незавершена оплачена покупка видає Pass і споживається; повторний restore нічого не додає', async () => {
  const f = new FakePlay();
  f.owned = [{ productIdentifier: 'pass_30d', purchaseToken: 'late', orderId: 'GPA.9', purchaseState: '1' }];
  const { st, redeem } = store();
  const b = createPlayBilling(f, 'pass_30d');
  assert.equal(await b.restore(redeem), 1);
  assert.equal(st.s.passUntil, T + 30 * DAY_MS);
  assert.ok(f.calls.includes('consume:late'));
  assert.equal(await b.restore(redeem), 0);
  assert.equal(st.s.passUntil, T + 30 * DAY_MS);
});

test('restore: споживання не вдається — подвійного обліку немає, споживання повторюється, поки не вийде', () =>
  quiet(async () => {
    const f = new FakePlay();
    f.consumeFails = true;
    f.owned = [{ productIdentifier: 'pass_30d', purchaseToken: 'stuck', orderId: 'GPA.7', purchaseState: '1' }];
    const { st, redeem } = store();
    const b = createPlayBilling(f, 'pass_30d');
    assert.equal(await b.restore(redeem), 1);
    assert.equal(await b.restore(redeem), 0);
    assert.equal(await b.restore(redeem), 0);
    assert.equal(st.s.passUntil, T + 30 * DAY_MS, 'Pass продовжено лише один раз');
    assert.equal(f.calls.filter((c) => c === 'consume:stuck').length, 3);
    f.consumeFails = false;
    assert.equal(await b.restore(redeem), 0);
    assert.equal(f.owned.length, 0, 'нарешті спожито');
  }));

test('restore: pending, чужий продукт і покупка без токена ігноруються; дві оплачені дають два продовження', async () => {
  const f = new FakePlay();
  f.owned = [
    { productIdentifier: 'pass_30d', purchaseToken: 'pend', purchaseState: '2' },
    { productIdentifier: 'other', purchaseToken: 'o', purchaseState: '1' },
    { productIdentifier: 'pass_30d', purchaseToken: '', orderId: '', purchaseState: '1' },
    { productIdentifier: 'pass_30d', purchaseToken: 'p1', purchaseState: '1' },
    { productIdentifier: 'pass_30d', purchaseToken: 'p2', purchaseState: '1' },
  ];
  const { st, redeem } = store();
  assert.equal(await createPlayBilling(f, 'pass_30d').restore(redeem), 2);
  assert.equal(st.s.passUntil, T + 60 * DAY_MS);
  assert.ok(!f.calls.includes('consume:pend') && !f.calls.includes('consume:o'));
});

test('restore: збій getPurchases — BillingError(restore), стан не чіпається', async () => {
  const f = new FakePlay();
  f.failGetPurchases = true;
  const { st, redeem } = store();
  await assert.rejects(createPlayBilling(f, 'pass_30d').restore(redeem), (e: unknown) => e instanceof BillingError && e.stage === 'restore');
  assert.equal(st.s.passUntil, null);
});

test('buy: ITEM_ALREADY_OWNED — забирає незавершену покупку через restore (granted); якщо нічого немає — error', () =>
  quiet(async () => {
    const f = new FakePlay();
    f.buyResult = err('ITEM_ALREADY_OWNED', 'Purchase is not purchased');
    f.owned = [{ productIdentifier: 'pass_30d', purchaseToken: 'own', purchaseState: '1' }];
    const { st, redeem } = store();
    const b = createPlayBilling(f, 'pass_30d');
    assert.equal(await b.buy(redeem), 'granted');
    assert.equal(st.s.passUntil, T + 30 * DAY_MS);
    f.owned = [];
    assert.equal(await b.buy(redeem), 'error');
  }));
