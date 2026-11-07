import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DAY_MS, FREE_ACCESS, grantPass } from '../src/domain/access.ts';
import { COUNTDOWN_MS, GATE_IDLE, adGate, type GateState } from '../src/domain/adGate.ts';
import { fmt } from '../src/domain/i18n/fmt.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { gateView } from '../src/monetization/gateView.ts';
import { STUB_BILLING_MARKER, createStubBilling } from '../src/monetization/billingStub.ts';

test('fmt: підставляє {name}, невідомі плейсхолдери лишає, числа форматує як рядки', () => {
  assert.equal(fmt('Reklama {n} z 2, cena {price}', { n: 1, price: '9,99 zł' }), 'Reklama 1 z 2, cena 9,99 zł');
  assert.equal(fmt('{x} i {y}', { x: 'A' }), 'A i {y}');
  assert.equal(fmt('bez zmian', {}), 'bez zmian');
});

test('gateView: усі стани автомата мають вигляд; повтор пропонується лише після збою або дострокового закриття', () => {
  const states: Array<[GateState, boolean, string, number]> = [
    [GATE_IDLE, false, 'intro', 1],
    [GATE_IDLE, true, 'intro', 2],
    [{ kind: 'loading1', waitedMs: 0, paused: false }, false, 'loading', 1],
    [{ kind: 'loading2', waitedMs: 0, paused: false }, true, 'loading', 2],
    [{ kind: 'showing1' }, false, 'showing', 1],
    [{ kind: 'showing2' }, true, 'showing', 2],
    [{ kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'load' }, true, 'countdown', 2],
    [{ kind: 'failed1', reason: 'load' }, false, 'failed', 1],
    [{ kind: 'early1' }, false, 'early', 1],
    [{ kind: 'early2' }, true, 'early', 2],
    [{ kind: 'granted', via: 'ad' }, true, 'granted', 2],
  ];
  for (const [s, ad1, phase, idx] of states) {
    const v = gateView(s, ad1);
    assert.equal(v.phase, phase, s.kind);
    assert.equal(v.adIndex, idx, s.kind);
    assert.equal(v.canRetry, phase === 'failed' || phase === 'early', s.kind);
  }
});

test('gateView: відлік — секунди вгору, прогрес 0→1, пауза; причина збою першої реклами', () => {
  const a = gateView({ kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'load' }, true);
  assert.deepEqual([a.seconds, a.progress, a.paused], [20, 0, false]);
  const b = gateView({ kind: 'countdown', remainingMs: 8_500, paused: true, reason: 'load' }, true);
  assert.deepEqual([b.seconds, b.paused], [9, true]);
  assert.ok(Math.abs(b.progress - 0.575) < 1e-9);
  assert.equal(gateView({ kind: 'countdown', remainingMs: 0, paused: false, reason: 'load' }, true).progress, 1);
  assert.equal(gateView({ kind: 'failed1', reason: 'consent' }, false).reason, 'consent');
  // цикл автомата → вигляд: від першої реклами до нагороди
  let s: GateState = GATE_IDLE;
  const seen: string[] = [];
  for (const e of [{ type: 'START', ad1Done: false }, { type: 'LOADED' }, { type: 'AD_COMPLETED' }, { type: 'LOADED' }, { type: 'AD_COMPLETED' }] as const) {
    s = adGate(s, e);
    seen.push(gateView(s, false).phase);
  }
  assert.deepEqual(seen, ['loading', 'showing', 'loading', 'showing', 'granted']);
});

test('заглушка billing: ціна 9,99 zł, buy видає Pass через redeem і повертає granted; знак для check:prod', async () => {
  const b = createStubBilling(() => 5_000, 0);
  assert.equal((await b.product())?.price, '9,99 zł');
  let got: string[] = [];
  assert.equal(await b.buy((ids) => ((got = ids), true)), 'granted');
  assert.equal(got.length, 1);
  assert.equal(grantPass(FREE_ACCESS, 5_000, 30, got).passUntil, 5_000 + 30 * DAY_MS);
  assert.equal(STUB_BILLING_MARKER, 'CVMAKER_STUB_BILLING_DEV_ONLY');
});

const KEYS = [
  'gate_title', 'gate_req', 'gate_price_unknown', 'gate_req1', 'gate_pass_note', 'gate_offline_note', 'gate_watch', 'gate_watch2',
  'gate_loading_n', 'gate_showing_n', 'gate_countdown', 'gate_countdown_paused', 'gate_cancel', 'gate_fail', 'gate_consent',
  'gate_consent_btn', 'gate_no_reward', 'gate_retry', 'gate_buy', 'pass_title', 'pass_text', 'pass_back', 'pass_buy', 'pass_buying',
  'pass_fail', 'pass_pending', 'pass_stub_note', 'pass_unavailable', 'pass_active', 'pass_none', 'set_pdf_title',
];

test('тексти вікна експорту: усі ключі є в PL, UA, EN; плейсхолдери збігаються між мовами', () => {
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const k of KEYS) assert.ok(((MESSAGES[lang] as Record<string, string>)[k] ?? '').trim().length > 0, `${lang}.${k}`);
  }
  for (const k of KEYS) {
    const ph = (l: 'pl' | 'uk' | 'en') => ((MESSAGES[l] as Record<string, string>)[k].match(/\{\w+\}/g) ?? []).sort().join(',');
    assert.equal(ph('uk'), ph('pl'), k);
    assert.equal(ph('en'), ph('pl'), k);
  }
  for (const k of ['gate_req', 'pass_text']) for (const l of ['pl', 'uk', 'en'] as const) assert.match((MESSAGES[l] as Record<string, string>)[k], /\{price\}/);
  for (const [k, v] of Object.entries(MESSAGES.uk)) if (/^(gate_|pass_|set_pdf)/.test(k)) assert.ok(!/[ыэъё]/i.test(v), k);
});

test('тексти: умова D1 і чесний текст D7 дослівно; Pass лишається «Pass» у всіх мовах; «без автоматичного поновлення», а не «це не підписка»', () => {
  assert.equal(MESSAGES.pl.gate_req, 'Obejrzyj 2 reklamy, aby pobrać PDF, albo kup Pass 30 dni ({price}).');
  assert.equal(MESSAGES.pl.gate_offline_note, 'Edytować CV możesz bez internetu. Pobranie PDF wymaga obejrzenia reklam lub Pass 30 dni.');
  assert.equal(MESSAGES.pl.gate_price_unknown, 'cena w Google Play');
  for (const l of ['pl', 'uk', 'en'] as const) {
    const m = MESSAGES[l] as Record<string, string>;
    for (const k of ['gate_req', 'gate_pass_note', 'pass_title', 'gate_buy', 'pass_buy']) assert.match(m[k], /Pass/, `${l}.${k}`);
    assert.doesNotMatch(Object.values(m).filter((v) => /Pass/.test(v)).join(' '), /subskrypcj|підписк|subscription/i, l);
  }
  assert.match(MESSAGES.pl.pass_text, /bez automatycznego odnawiania/);
  assert.match(MESSAGES.pl.gate_pass_note, /bez automatycznego odnawiania/);
  assert.match(MESSAGES.uk.pass_text, /без автоматичного поновлення/);
  assert.match(MESSAGES.uk.gate_pass_note, /без автоматичного поновлення/);
  assert.match(MESSAGES.en.pass_text, /no automatic renewal/);
  assert.match(MESSAGES.en.gate_pass_note, /no automatic renewal/);
});

test('ціна береться з магазину: у текстах немає жорстко вписаної суми, є запасна фраза без числа', () => {
  for (const l of ['pl', 'uk', 'en'] as const) {
    const m = MESSAGES[l] as Record<string, string>;
    for (const k of ['gate_req', 'pass_text', 'gate_pass_note', 'gate_consent', 'gate_price_unknown']) assert.doesNotMatch(m[k], /\d+[,.]\d{2}/, `${l}.${k}`);
  }
});

test('варіант без Pass (billingAvailable=false): тексти лише про реклами, без Pass, ціни й плейсхолдерів', () => {
  for (const l of ['pl', 'uk', 'en'] as const) {
    const m = MESSAGES[l] as Record<string, string>;
    for (const k of ['gate_req_ads', 'gate_offline_ads', 'gate_consent_ads', 'pdf_hint_ads']) {
      assert.ok(m[k]?.trim(), `${l}.${k}`);
      assert.doesNotMatch(m[k], /Pass|\{\w+\}/, `${l}.${k}`);
    }
    assert.match(m.pdf_hint, /Pass/, l);
    assert.match(m.pdf_hint_ads, /2/, l);
  }
  assert.equal(MESSAGES.pl.pdf_hint, '2 reklamy lub Pass 30 dni');
  assert.equal(MESSAGES.pl.pdf_hint_ads, '2 reklamy');
  assert.equal(MESSAGES.uk.gate_no_reward, 'Рекламу закрито достроково, тому винагороду не нараховано. Перегляньте її повністю.');
});

test('billingAvailable: dev-заглушка або нативний Android; вікно й Налаштування спираються на нього', () => {
  const src = readFileSync('src/monetization/billing.ts', 'utf8');
  assert.match(src, /export function billingAvailable\(\): boolean \{\s*return isStubBilling\(\) \|\| isPlayBilling\(\);/);
  assert.match(readFileSync('src/monetization/ExportGateDialog.tsx', 'utf8'), /billingAvailable\(\)/);
  assert.match(readFileSync('src/components/Settings.tsx', 'utf8'), /gateActive\(\) && billingAvailable\(\)/);
});
