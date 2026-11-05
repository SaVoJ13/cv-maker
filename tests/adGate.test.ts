import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTDOWN_MS,
  GATE_IDLE,
  LOAD_TIMEOUT_MS,
  MAX_TICK_MS,
  adGate,
  countdownSeconds,
  gateEffects,
  type AdFailReason,
  type GateEffect,
  type GateEvent,
  type GateState,
} from '../src/domain/adGate.ts';

/** Проганяє події; повертає останній стан і всі ефекти в порядку виникнення. */
function run(events: GateEvent[], from: GateState = GATE_IDLE): { state: GateState; effects: GateEffect[]; trail: GateState[] } {
  let state = from;
  const effects: GateEffect[] = [];
  const trail: GateState[] = [state];
  for (const e of events) {
    const next = adGate(state, e);
    effects.push(...gateEffects(state, next));
    state = next;
    trail.push(state);
  }
  return { state, effects, trail };
}

const START: GateEvent = { type: 'START', ad1Done: false };
const START2: GateEvent = { type: 'START', ad1Done: true };
const LOADED: GateEvent = { type: 'LOADED' };
const DONE: GateEvent = { type: 'AD_COMPLETED' };
const EARLY: GateEvent = { type: 'AD_CLOSED_EARLY' };
const fail = (reason: AdFailReason): GateEvent => ({ type: 'LOAD_FAILED', reason });
const tick = (ms: number): GateEvent => ({ type: 'TICK', ms });
const ticks = (total: number, step = 1000): GateEvent[] => Array.from({ length: Math.floor(total / step) }, () => tick(step));

test('шлях без збоїв: дві реклами → нагорода; ефекти load1, show, recordAd1, load2, show, grantReward', () => {
  const r = run([START, LOADED, DONE, LOADED, DONE]);
  assert.deepEqual(r.state, { kind: 'granted', via: 'ad' });
  assert.deepEqual(r.effects, ['load1', 'show', 'recordAd1', 'load2', 'show', 'grantReward']);
  assert.deepEqual(r.trail.map((s) => s.kind), ['idle', 'loading1', 'showing1', 'loading2', 'showing2', 'granted']);
});

test('перша вже переглянута (прогрес живий): START починає з другої, recordAd1 не повторюється', () => {
  const r = run([START2, LOADED, DONE]);
  assert.deepEqual(r.state, { kind: 'granted', via: 'ad' });
  assert.deepEqual(r.effects, ['load2', 'show', 'grantReward']);
});

test('перша реклама не завантажилась: запасного варіанту немає — failed1, нагороди ні за яких подій, окрім повтору', () => {
  for (const reason of ['load', 'consent'] as const) {
    const r = run([START, fail(reason)]);
    assert.deepEqual(r.state, { kind: 'failed1', reason });
    // жодні події (час, інші реклами, фон) не дають нагороди
    const after = run([...ticks(60_000), LOADED, DONE, EARLY, { type: 'APP_BACKGROUND' }, { type: 'APP_FOREGROUND' }, { type: 'SHOW_FAILED' }], r.state);
    assert.deepEqual(after.state, { kind: 'failed1', reason });
    assert.ok(!after.effects.includes('grantReward'));
    // повторна спроба — з нуля
    assert.deepEqual(run([{ type: 'RETRY' }], r.state).state, { kind: 'loading1', waitedMs: 0, paused: false });
    assert.deepEqual(run([{ type: 'RETRY' }], r.state).effects, ['load1']);
  }
});

test('перша реклама: тайм-аут завантаження рівно 8 с; не показалась → failed1(show)', () => {
  const almost = run([START, ...ticks(LOAD_TIMEOUT_MS - 1000), tick(999)]);
  assert.equal(almost.state.kind, 'loading1');
  assert.deepEqual(run([START, ...ticks(LOAD_TIMEOUT_MS)]).state, { kind: 'failed1', reason: 'timeout' });
  assert.deepEqual(run([START, LOADED, { type: 'SHOW_FAILED' }]).state, { kind: 'failed1', reason: 'show' });
});

test('друга не завантажилась (load, consent): відлік 20 с, потім нагорода; прогрес першої вже збережено', () => {
  for (const reason of ['load', 'consent'] as const) {
    const r = run([START, LOADED, DONE, fail(reason)]);
    assert.deepEqual(r.state, { kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason });
    assert.ok(r.effects.includes('recordAd1'));
    assert.ok(!r.effects.includes('grantReward'));
    const fin = run(ticks(COUNTDOWN_MS - 1000), r.state);
    assert.deepEqual(countdownSeconds(fin.state), 1);
    const done = run([tick(1000)], fin.state);
    assert.deepEqual(done.state, { kind: 'granted', via: 'countdown' });
    assert.deepEqual(done.effects, ['grantReward']);
  }
});

test('друга: тайм-аут завантаження 8 с і збій показу → теж відлік 20 с', () => {
  assert.deepEqual(run([START2, ...ticks(LOAD_TIMEOUT_MS)]).state, { kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'timeout' });
  assert.deepEqual(run([START2, LOADED, { type: 'SHOW_FAILED' }]).state, { kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'show' });
});

test('відлік не пропускається: нагорода лише після рівно 20 000 мс; інші події (реклама, LOADED, повтор) його не скорочують', () => {
  const start = run([START2, fail('load')]).state;
  const noSkip = run([LOADED, DONE, EARLY, { type: 'RETRY' }, { type: 'SHOW_FAILED' }, START, START2, fail('load')], start);
  assert.deepEqual(noSkip.state, start);
  assert.ok(!noSkip.effects.includes('grantReward'));
  assert.equal(run([...ticks(COUNTDOWN_MS - 1), tick(0)], start).state.kind, 'countdown');
  assert.equal(run(ticks(COUNTDOWN_MS), start).state.kind, 'granted');
  // від'ємні, нульові й нечислові тіки нічого не дають
  const junk = run([tick(-5000), tick(0), tick(NaN), tick(Infinity)], start).state as { remainingMs: number };
  assert.equal(junk.remainingMs, COUNTDOWN_MS);
});

test('один TICK враховується не більше MAX_TICK_MS: «заснулі» таймери не перестрибують відлік', () => {
  const start = run([START2, fail('load')]).state;
  const s = run([tick(60_000)], start).state as { remainingMs: number };
  assert.equal(s.remainingMs, COUNTDOWN_MS - MAX_TICK_MS);
  // так само для очікування завантаження
  const l = run([START2, tick(60_000)]).state as { waitedMs: number };
  assert.equal(l.waitedMs, MAX_TICK_MS);
});

test('застосунок у фоні під час відліку: пауза, час не тече; після повернення відлік продовжується з того ж місця', () => {
  const mid = run([START2, fail('load'), ...ticks(5000)]).state;
  assert.equal(countdownSeconds(mid), 15);
  const bg = run([{ type: 'APP_BACKGROUND' }], mid).state;
  assert.deepEqual(bg, { kind: 'countdown', remainingMs: 15_000, paused: true, reason: 'load' });
  const whileBg = run([...ticks(120_000)], bg).state;
  assert.deepEqual(whileBg, bg, 'на паузі тіки ігноруються');
  const back = run([{ type: 'APP_FOREGROUND' }, ...ticks(15_000)], whileBg);
  assert.deepEqual(back.state, { kind: 'granted', via: 'countdown' });
  // повторні події фону не ламають
  assert.deepEqual(run([{ type: 'APP_FOREGROUND' }, { type: 'APP_FOREGROUND' }], mid).state, mid);
});

test('очікування завантаження теж ставиться на паузу у фоні й не рахує тайм-аут', () => {
  const s = run([START2, ...ticks(3000), { type: 'APP_BACKGROUND' }, ...ticks(30_000)]).state;
  assert.deepEqual(s, { kind: 'loading2', waitedMs: 3000, paused: true });
  assert.equal(run([{ type: 'APP_FOREGROUND' }, ...ticks(5000)], s).state.kind, 'countdown');
});

test('застосунок вивантажили (APP_RESTORED): усе скидається, відлік іде заново з 20 с', () => {
  const mid = run([START2, fail('load'), ...ticks(12_000)]).state;
  assert.equal(countdownSeconds(mid), 8);
  const restored = run([{ type: 'APP_RESTORED' }], mid).state;
  assert.deepEqual(restored, GATE_IDLE);
  // прогрес першої реклами береться з access (ad1Done), друга знову не завантажилась → повні 20 с
  const again = run([START2, fail('load')], restored).state;
  assert.deepEqual(again, { kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'load' });
  for (const s of [GATE_IDLE, mid, run([START, LOADED, DONE]).state, { kind: 'granted', via: 'ad' } as GateState]) {
    assert.deepEqual(adGate(s, { type: 'APP_RESTORED' }), GATE_IDLE);
  }
});

test('перша закрита достроково: нагороди ні, повтор з нуля (loading1, без recordAd1)', () => {
  const r = run([START, LOADED, EARLY]);
  assert.deepEqual(r.state, { kind: 'early1' });
  assert.ok(!r.effects.includes('recordAd1') && !r.effects.includes('grantReward'));
  const retry = run([{ type: 'RETRY' }, LOADED, DONE, LOADED, DONE], r.state);
  assert.deepEqual(retry.state, { kind: 'granted', via: 'ad' });
  assert.deepEqual(retry.effects, ['load1', 'show', 'recordAd1', 'load2', 'show', 'grantReward']);
  // у early1 час нічого не дає
  assert.deepEqual(run(ticks(60_000), r.state).state, { kind: 'early1' });
});

test('друга закрита достроково: нагороди ні, прогрес першої лишається, повторюється лише друга', () => {
  const r = run([START, LOADED, DONE, LOADED, EARLY]);
  assert.deepEqual(r.state, { kind: 'early2' });
  assert.deepEqual(r.effects.filter((e) => e === 'recordAd1'), ['recordAd1'], 'прогрес збережено один раз');
  assert.ok(!r.effects.includes('grantReward'));
  const retry = run([{ type: 'RETRY' }], r.state);
  assert.deepEqual(retry.state, { kind: 'loading2', waitedMs: 0, paused: false });
  assert.deepEqual(retry.effects, ['load2'], 'друга реклама, а не перша; recordAd1 вдруге не видається');
  assert.deepEqual(run([LOADED, DONE], retry.state).state, { kind: 'granted', via: 'ad' });
  // без повтору час не дає відліку й нагороди (запасний варіант — лише для збоїв, а не для дострокового закриття)
  assert.deepEqual(run(ticks(60_000), r.state).state, { kind: 'early2' });
});

test('повторна спроба після збою другої реклами в відліку недоступна (RETRY ігнорується), закрити вікно можна', () => {
  const cd = run([START2, fail('load')]).state;
  assert.deepEqual(adGate(cd, { type: 'RETRY' }), cd);
  assert.deepEqual(adGate(cd, { type: 'CANCEL' }), GATE_IDLE);
});

test('CANCEL у будь-якому стані веде в idle (у idle — той самий об’єкт); START лише з idle', () => {
  const states: GateState[] = [
    run([START]).state, run([START, LOADED]).state, run([START, LOADED, DONE]).state, run([START2, LOADED]).state,
    run([START2, fail('show')]).state, run([START, fail('load')]).state, run([START, LOADED, EARLY]).state,
    run([START2, LOADED, EARLY]).state, run([START2, LOADED, DONE]).state,
  ];
  for (const s of states) {
    assert.deepEqual(adGate(s, { type: 'CANCEL' }), GATE_IDLE, s.kind);
    assert.deepEqual(adGate(s, START), s, `START у ${s.kind} ігнорується`);
  }
  assert.equal(adGate(GATE_IDLE, { type: 'CANCEL' }), GATE_IDLE);
});

test('після нагороди стан granted стабільний; CANCEL повертає в idle', () => {
  const g = run([START2, LOADED, DONE]).state;
  assert.deepEqual(g, { kind: 'granted', via: 'ad' });
  assert.deepEqual(run([...ticks(5000), LOADED, DONE, EARLY, START, { type: 'RETRY' }], g).state, g);
  assert.deepEqual(adGate(g, { type: 'CANCEL' }), GATE_IDLE);
});

test('автомат чистий: не змінює вхідний стан, однакові входи дають однаковий результат', () => {
  const s: GateState = { kind: 'countdown', remainingMs: 9000, paused: false, reason: 'load' };
  const copy = structuredClone(s);
  const a = adGate(s, tick(1000));
  const b = adGate(s, tick(1000));
  assert.deepEqual(s, copy);
  assert.deepEqual(a, b);
  assert.deepEqual(gateEffects(s, s), []);
});

test('властивість: нагорода видається лише після двох реклам або після першої + повного відліку; без збою другої відліку немає', () => {
  let seed = 987654321;
  const rnd = (n: number): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };
  const kinds: Array<() => GateEvent> = [
    () => START,
    () => START2,
    () => LOADED,
    () => DONE,
    () => EARLY,
    () => fail((['load', 'timeout', 'show', 'consent'] as const)[rnd(4)]),
    () => ({ type: 'SHOW_FAILED' }),
    () => tick([0, 100, 500, 1000, 1500, 5000][rnd(6)]),
    () => ({ type: 'APP_BACKGROUND' }),
    () => ({ type: 'APP_FOREGROUND' }),
    () => ({ type: 'APP_RESTORED' }),
    () => ({ type: 'RETRY' }),
    () => ({ type: 'CANCEL' }),
  ];
  let grants = 0;
  for (let run_ = 0; run_ < 3000; run_++) {
    let state: GateState = GATE_IDLE;
    let ad1 = false; // перша реклама зараховується (прогрес живий) у цьому «сеансі»
    let countdownMs = 0; // скільки мс відліку реально минуло без паузи
    for (let i = 0; i < 40; i++) {
      const e = kinds[rnd(kinds.length)]();
      const prev = state;
      const next = adGate(prev, e);
      if (prev.kind === 'idle' && e.type === 'START' && e.ad1Done) ad1 = true;
      if (prev.kind === 'showing1' && next.kind === 'loading2') ad1 = true;
      if (e.type === 'APP_RESTORED') countdownMs = 0;
      if (prev.kind !== 'countdown' && next.kind === 'countdown') countdownMs = 0;
      if (prev.kind === 'countdown' && next.kind === 'countdown' && e.type === 'TICK' && !prev.paused) countdownMs += prev.remainingMs - next.remainingMs;
      if (next.kind === 'countdown') assert.ok(ad1, 'відлік можливий лише після першої реклами');
      if (next.kind === 'granted' && prev.kind !== 'granted') {
        grants += 1;
        assert.ok(ad1, 'нагорода без першої реклами');
        if (next.via === 'countdown') {
          assert.ok(prev.kind === 'countdown', 'нагорода відліком не з відліку');
          assert.ok(countdownMs + (prev.kind === 'countdown' ? prev.remainingMs - 0 : 0) >= COUNTDOWN_MS - 1e-6, 'відлік скорочено');
        } else {
          assert.equal(prev.kind, 'showing2');
        }
      }
      state = next;
    }
  }
  assert.ok(grants > 100, `нагород у прогонах: ${grants}`);
});
