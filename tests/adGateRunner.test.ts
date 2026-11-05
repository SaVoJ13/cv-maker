import test from 'node:test';
import assert from 'node:assert/strict';
import { AdFailure, AdGateRunner, TICK_INTERVAL_MS, type AdsPort } from '../src/monetization/adGateRunner.ts';
import { createStubAdsPort, parseStubScript } from '../src/monetization/adsStub.ts';
import { COUNTDOWN_MS, LOAD_TIMEOUT_MS, type GateState } from '../src/domain/adGate.ts';

/** Керований порт: кожен load/show повертає проміс, який тест закінчує вручну. */
function manualPort() {
  const loads: Array<{ ok: () => void; fail: (e: unknown) => void }> = [];
  const shows: Array<{ done: (r: 'completed' | 'closed-early') => void; fail: (e: unknown) => void }> = [];
  const port: AdsPort = {
    load: () => new Promise<void>((ok, fail) => loads.push({ ok, fail })),
    show: () => new Promise((done, fail) => shows.push({ done, fail })),
  };
  return { port, loads, shows };
}

/** Фейковий монотонний годинник і планувальник інтервалів. */
function fakeTime() {
  let t = 1000;
  let fn: (() => void) | null = null;
  let intervals = 0;
  return {
    now: () => t,
    every: (f: () => void) => {
      fn = f;
      intervals += 1;
      return () => {
        if (fn === f) fn = null;
      };
    },
    /** Просуває час тіками по 250 мс (як справжній інтервал) */
    advance(ms: number) {
      for (let left = ms; left > 0; left -= TICK_INTERVAL_MS) {
        t += Math.min(TICK_INTERVAL_MS, left);
        fn?.();
      }
    },
    /** Просуває час без тіків (таймери «заснули») */
    jump(ms: number) {
      t += ms;
    },
    get running() {
      return fn !== null;
    },
    get intervals() {
      return intervals;
    },
  };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

function setup() {
  const mp = manualPort();
  const time = fakeTime();
  const states: GateState[] = [];
  const calls = { ad1: 0, granted: 0 };
  const runner = new AdGateRunner({
    port: mp.port,
    now: time.now,
    every: time.every,
    onState: (s) => states.push(s),
    onAd1Rewarded: () => (calls.ad1 += 1),
    onGranted: () => (calls.granted += 1),
  });
  return { ...mp, time, states, calls, runner };
}

test('виконавець: дві реклами → прогрес першої, нагорода; порт викликається в правильному порядку', async () => {
  const c = setup();
  c.runner.start(false);
  assert.equal(String(c.runner.current.kind), 'loading1');
  assert.equal(c.loads.length, 1);
  c.loads[0].ok();
  await flush();
  assert.equal(String(c.runner.current.kind), 'showing1');
  assert.equal(c.shows.length, 1);
  c.shows[0].done('completed');
  await flush();
  assert.equal(String(c.runner.current.kind), 'loading2');
  assert.equal(c.calls.ad1, 1);
  assert.equal(c.loads.length, 2);
  c.loads[1].ok();
  await flush();
  c.shows[1].done('completed');
  await flush();
  assert.deepEqual(c.runner.current, { kind: 'granted', via: 'ad' });
  assert.deepEqual(c.calls, { ad1: 1, granted: 1 });
  assert.equal(c.time.running, false, 'таймер зупинено');
});

test('перша реклама: помилка завантаження → failed1 без нагороди й відліку; повтор запускає нове завантаження', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].fail(new AdFailure('load'));
  await flush();
  assert.deepEqual(c.runner.current, { kind: 'failed1', reason: 'load' });
  c.time.advance(120_000);
  assert.equal(String(c.runner.current.kind), 'failed1');
  assert.equal(c.calls.granted, 0);
  c.runner.retry();
  assert.equal(c.loads.length, 2);
  assert.equal(String(c.runner.current.kind), 'loading1');
});

test('відмова в згоді (consent) і довільна помилка порту класифікуються', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].fail(new AdFailure('consent'));
  await flush();
  assert.deepEqual(c.runner.current, { kind: 'failed1', reason: 'consent' });
  const d = setup();
  d.runner.start(false);
  d.loads[0].fail(new Error('невідомо'));
  await flush();
  assert.deepEqual(d.runner.current, { kind: 'failed1', reason: 'load' });
});

test('тайм-аут завантаження 8 с (за фейковим годинником): перша → failed1(timeout), друга → відлік', async () => {
  const c = setup();
  c.runner.start(false);
  c.time.advance(LOAD_TIMEOUT_MS - 250);
  assert.equal(String(c.runner.current.kind), 'loading1');
  c.time.advance(250);
  assert.deepEqual(c.runner.current, { kind: 'failed1', reason: 'timeout' });
  const d = setup();
  d.runner.start(true);
  d.time.advance(LOAD_TIMEOUT_MS);
  assert.deepEqual(d.runner.current, { kind: 'countdown', remainingMs: COUNTDOWN_MS, paused: false, reason: 'timeout' });
});

test('друга не завантажилась: відлік 20 с → нагорода, не раніше; прогрес першої вже збережено', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].ok();
  await flush();
  c.shows[0].done('completed');
  await flush();
  c.loads[1].fail(new AdFailure('load'));
  await flush();
  assert.equal(String(c.runner.current.kind), 'countdown');
  assert.equal(c.calls.ad1, 1);
  c.time.advance(COUNTDOWN_MS - 250);
  assert.equal(c.calls.granted, 0);
  c.time.advance(250);
  assert.deepEqual(c.runner.current, { kind: 'granted', via: 'countdown' });
  assert.equal(c.calls.granted, 1);
  assert.equal(c.time.running, false);
});

test('фон під час відліку: час не тече, після повернення продовжується; тривала пауза без тіків не перестрибує відлік', async () => {
  const c = setup();
  c.runner.start(true);
  c.loads[0].fail(new AdFailure('load'));
  await flush();
  c.time.advance(5000);
  c.runner.appBackground();
  c.time.advance(300_000);
  assert.equal(String(c.runner.current.kind), 'countdown');
  assert.equal((c.runner.current as unknown as { remainingMs: number }).remainingMs, COUNTDOWN_MS - 5000);
  c.runner.appForeground();
  c.time.advance(14_750);
  assert.equal(c.calls.granted, 0);
  c.time.advance(250);
  assert.equal(c.calls.granted, 1);
  // «заснулі» таймери: годинник стрибнув на хвилину без тіків, а потім прийшов один тік
  const d = setup();
  d.runner.start(true);
  d.loads[0].fail(new AdFailure('load'));
  await flush();
  d.time.jump(60_000);
  d.time.advance(250);
  assert.ok((d.runner.current as unknown as { remainingMs: number }).remainingMs >= COUNTDOWN_MS - 2250, 'відлік не перестрибнув');
});

test('дострокове закриття першої: повтор з нуля (нове завантаження, прогрес не записано); другої: повторюється лише друга', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].ok();
  await flush();
  c.shows[0].done('closed-early');
  await flush();
  assert.equal(String(c.runner.current.kind), 'early1');
  assert.equal(c.calls.ad1, 0);
  c.runner.retry();
  c.loads[1].ok();
  await flush();
  c.shows[1].done('completed');
  await flush();
  assert.equal(c.calls.ad1, 1);
  c.loads[2].ok();
  await flush();
  c.shows[2].done('closed-early');
  await flush();
  assert.equal(String(c.runner.current.kind), 'early2');
  c.runner.retry();
  assert.equal(String(c.runner.current.kind), 'loading2');
  assert.equal(c.calls.ad1, 1, 'прогрес не записується вдруге');
  assert.equal(c.loads.length, 4);
});

test('збій показу: перша → failed1(show), друга → відлік', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].ok();
  await flush();
  c.shows[0].fail(new AdFailure('show'));
  await flush();
  assert.deepEqual(c.runner.current, { kind: 'failed1', reason: 'show' });
  const d = setup();
  d.runner.start(true);
  d.loads[0].ok();
  await flush();
  d.shows[0].fail(new AdFailure('show'));
  await flush();
  assert.equal(String(d.runner.current.kind), 'countdown');
});

test('застарілі результати ігноруються: пізня відповідь старого завантаження після повтору чи скасування нічого не змінює', async () => {
  const c = setup();
  c.runner.start(false);
  c.loads[0].fail(new AdFailure('load'));
  await flush();
  c.runner.retry(); // нове завантаження loads[1]
  c.loads[0].ok(); // пізня «успішна» відповідь старого — ігнорується
  await flush();
  assert.equal(String(c.runner.current.kind), 'loading1');
  c.runner.cancel();
  c.loads[1].ok();
  await flush();
  assert.equal(String(c.runner.current.kind), 'idle');
  assert.equal(c.shows.length, 0, 'реклама не показується після скасування');
});

test('cancel і dispose зупиняють таймер; повторний запуск після скасування працює', async () => {
  const c = setup();
  c.runner.start(true);
  assert.equal(c.time.running, true);
  c.runner.cancel();
  assert.equal(c.time.running, false);
  c.runner.start(true);
  assert.equal(c.time.running, true);
  c.runner.dispose();
  assert.equal(c.time.running, false);
  assert.equal(String(c.runner.current.kind), 'idle');
});

test('вивантаження застосунку (appRestored) скидає все; відлік починається заново', async () => {
  const c = setup();
  c.runner.start(true);
  c.loads[0].fail(new AdFailure('load'));
  await flush();
  c.time.advance(10_000);
  c.runner.appRestored();
  assert.equal(String(c.runner.current.kind), 'idle');
  assert.equal(c.time.running, false);
  c.runner.start(true);
  c.loads[1].fail(new AdFailure('load'));
  await flush();
  assert.equal((c.runner.current as unknown as { remainingMs: number }).remainingMs, COUNTDOWN_MS);
});

test('симулятор розробника: розбір сценарію й результати (без затримок)', async () => {
  assert.deepEqual(parseStubScript(null), ['ok']);
  assert.deepEqual(parseStubScript('ok, loadfail,мотлох,slow'), ['ok', 'loadfail', 'slow']);
  const p = createStubAdsPort(['ok', 'early', 'loadfail', 'consent', 'showfail'], { load: 0, show: 0 });
  await p.load();
  assert.equal(await p.show(), 'completed');
  await p.load();
  assert.equal(await p.show(), 'closed-early');
  await assert.rejects(p.load(), (e: unknown) => e instanceof AdFailure && e.reason === 'load');
  await assert.rejects(p.load(), (e: unknown) => e instanceof AdFailure && e.reason === 'consent');
  await p.load();
  await assert.rejects(p.show(), (e: unknown) => e instanceof AdFailure && e.reason === 'show');
  // останній результат повторюється
  await p.load();
  await assert.rejects(p.show(), (e: unknown) => e instanceof AdFailure && e.reason === 'show');
});
