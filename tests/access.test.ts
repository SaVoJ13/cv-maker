import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  AD_PROGRESS_TTL_MS,
  CLOCK_TOLERANCE_MS,
  FREE_ACCESS,
  PASS_DURATION_MS,
  ad1Alive,
  canExport,
  clearPass,
  clockRolledBack,
  consumeReward,
  grantReward,
  normalizeAccess,
  passActive,
  recordAd1,
  rewardAlive,
  setPass,
  touch,
  type AccessState,
} from '../src/domain/access.ts';
import { FEATURE_IDS, FEATURE_TIER, FREE_LIMITS, canAddCv, isFeatureId, ownCvCount } from '../src/domain/features.ts';
import { BACKUP_APP, serializeBackup } from '../src/domain/backup.ts';
import { blankCv, sampleCv } from '../src/domain/cvOps.ts';
import { ACCESS_KEY, loadAccess, saveAccess } from '../src/store/accessPersist.ts';

const ON = { gatingEnabled: true };
const OFF = { gatingEnabled: false };
const T = 1_000_000_000_000;
const MIN = 60_000;

/* ---------- дані рівнів: лишаються як дані на майбутнє, access.ts їх не використовує ---------- */

test('features: кожна функція має рівень, isFeatureId розпізнає лише відомі (дані на майбутнє)', () => {
  for (const f of FEATURE_IDS) assert.ok(FEATURE_TIER[f] === 'free' || FEATURE_TIER[f] === 'pro', f);
  assert.equal(isFeatureId('qr'), true);
  assert.equal(isFeatureId('qrr'), false);
  assert.equal(isFeatureId(5), false);
});

test('ліміт CV лишається лише як дані (FREE_LIMITS, canAddCv); застосунок його не застосовує', () => {
  const own = (n: number) => Array.from({ length: n }, () => blankCv());
  assert.equal(FREE_LIMITS.maxCvs, 2);
  assert.equal(ownCvCount([sampleCv(), ...own(1)]), 1);
  assert.equal(canAddCv(own(2), false), false);
  assert.equal(canAddCv(own(5), true), true);
  const used = fs.readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => /\.tsx?$/.test(f) && !f.includes(`domain${path.sep}features`) && !f.includes(`domain${path.sep}access`));
  for (const f of used) assert.ok(!/canAddCv|FREE_LIMITS/.test(fs.readFileSync(path.join('src', f), 'utf8')), `${f}: ліміт CV не повинен застосовуватись`);
});

test('access.ts не використовує рівні шаблонів і функцій (tier): доступ залежить лише від Pass і реклам', () => {
  const src = fs.readFileSync('src/domain/access.ts', 'utf8');
  assert.ok(!/from '\.\/(features|templates)'/.test(src));
  assert.ok(!/\b(templateTier|FEATURE_TIER|FREE_TEMPLATES)\b/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')));
});

/* ---------- canExport ---------- */

test('canExport: замок вимкнений (gatingEnabled = false) → free, незалежно від Pass і реклам', () => {
  assert.deepEqual(canExport(FREE_ACCESS, T, OFF), { mode: 'free', adsRequired: 0 });
  assert.deepEqual(canExport(setPass(FREE_ACCESS, T + 1000, T), T, OFF), { mode: 'free', adsRequired: 0 });
});

test('canExport: без Pass і реклам потрібні 2 реклами; після першої — 1; після нагороди — 0 (експорт дозволено)', () => {
  assert.deepEqual(canExport(FREE_ACCESS, T, ON), { mode: 'ads', adsRequired: 2 });
  const s1 = recordAd1(FREE_ACCESS, T);
  assert.deepEqual(canExport(s1, T + MIN, ON), { mode: 'ads', adsRequired: 1 });
  const s2 = grantReward(s1, T + 2 * MIN);
  assert.deepEqual(canExport(s2, T + 3 * MIN, ON), { mode: 'ads', adsRequired: 0 });
});

test('canExport: активний Pass → pass, реклами не потрібні; прострочений → знову реклами', () => {
  const s = setPass(FREE_ACCESS, T + PASS_DURATION_MS, T);
  assert.deepEqual(canExport(s, T + 1, ON), { mode: 'pass', adsRequired: 0 });
  assert.deepEqual(canExport(s, T + PASS_DURATION_MS - 1, ON), { mode: 'pass', adsRequired: 0 });
  assert.deepEqual(canExport(s, T + PASS_DURATION_MS, ON), { mode: 'ads', adsRequired: 2 });
  assert.deepEqual(canExport(s, T + PASS_DURATION_MS + 5, ON), { mode: 'ads', adsRequired: 2 });
});

test('Pass важливіший за нагороду й прогрес: з Pass нагорода не чіпається', () => {
  let s = grantReward(recordAd1(FREE_ACCESS, T), T + MIN);
  s = setPass(s, T + PASS_DURATION_MS, T + MIN);
  assert.equal(canExport(s, T + 2 * MIN, ON).mode, 'pass');
  assert.equal(s.rewardAt, T + MIN);
});

/* ---------- прогрес реклам і нагорода: 10 хвилин ---------- */

test('прогрес першої реклами живе рівно 10 хвилин (межа ±1 мс); з майбутнього недійсний', () => {
  const s = recordAd1(FREE_ACCESS, T);
  assert.equal(ad1Alive(s, T), true);
  assert.equal(ad1Alive(s, T + AD_PROGRESS_TTL_MS), true);
  assert.equal(ad1Alive(s, T + AD_PROGRESS_TTL_MS + 1), false);
  assert.deepEqual(canExport(s, T + AD_PROGRESS_TTL_MS + 1, ON), { mode: 'ads', adsRequired: 2 });
  assert.equal(ad1Alive({ ...s, ad1At: T + 5000 }, T), false, 'мітка з майбутнього');
});

test('нагорода діє 10 хвилин і не згорає сама після помилки PDF: лишається, поки не викликано consumeReward', () => {
  const s = grantReward(FREE_ACCESS, T);
  assert.equal(rewardAlive(s, T + AD_PROGRESS_TTL_MS), true);
  assert.equal(rewardAlive(s, T + AD_PROGRESS_TTL_MS + 1), false);
  // «PDF не створився»: стан не змінювали, нагорода на місці й можна повторити
  assert.deepEqual(canExport(s, T + 5 * MIN, ON), { mode: 'ads', adsRequired: 0 });
  assert.deepEqual(canExport(s, T + 9 * MIN, ON), { mode: 'ads', adsRequired: 0 });
  // успішний експорт витрачає її
  const used = consumeReward(s);
  assert.equal(used.rewardAt, null);
  assert.deepEqual(canExport(used, T + 9 * MIN, ON), { mode: 'ads', adsRequired: 2 });
});

test('grantReward очищає прогрес першої реклами; consumeReward без нагороди нічого не змінює', () => {
  const s = grantReward(recordAd1(FREE_ACCESS, T), T + MIN);
  assert.equal(s.ad1At, null);
  assert.equal(s.rewardAt, T + MIN);
  assert.equal(consumeReward(FREE_ACCESS), FREE_ACCESS);
});

/* ---------- захист від переведення годинника ---------- */

test('lastSeen: touch піднімає час і ніколи не зменшує', () => {
  const a = touch(FREE_ACCESS, T);
  assert.equal(a.lastSeen, T);
  assert.equal(touch(a, T - 5 * MIN).lastSeen, T);
  assert.equal(touch(a, T + 5).lastSeen, T + 5);
});

test('годинник відкотили: Pass і прогрес реклами недійсні, поки час не наздожене; допуск 2 хв на дрібні корекції', () => {
  let s = setPass(FREE_ACCESS, T + PASS_DURATION_MS, T);
  s = touch(s, T + 10 * 60 * MIN); // 10 годин користувались
  const seen = s.lastSeen;
  assert.equal(clockRolledBack(s, seen - CLOCK_TOLERANCE_MS), false, 'на межі допуску');
  assert.equal(clockRolledBack(s, seen - CLOCK_TOLERANCE_MS - 1), true);
  assert.equal(passActive(s, seen - CLOCK_TOLERANCE_MS), true);
  assert.equal(passActive(s, seen - CLOCK_TOLERANCE_MS - 1), false);
  assert.deepEqual(canExport(s, seen - 3 * MIN, ON), { mode: 'ads', adsRequired: 2 });
  // час наздогнав: Pass знову діє
  assert.equal(passActive(s, seen), true);
  assert.equal(passActive(s, seen + MIN), true);
  // відкат не зменшує lastSeen
  assert.equal(touch(s, seen - 60 * MIN).lastSeen, seen);
  // прогрес реклами теж недійсний під час відкату
  const p = touch(recordAd1(FREE_ACCESS, T), T + 5 * MIN);
  assert.equal(ad1Alive(p, T + 5 * MIN - 3 * MIN), false);
});

test('Pass: setPass не вкорочує довший Pass, clearPass прибирає, оновлює lastSeen', () => {
  const long = setPass(FREE_ACCESS, T + 100, T);
  assert.equal(setPass(long, T + 50, T + 1).passUntil, T + 100);
  assert.equal(setPass(long, T + 200, T + 1).passUntil, T + 200);
  assert.equal(setPass(FREE_ACCESS, T + 100, T + 7).lastSeen, T + 7);
  assert.equal(clearPass(long).passUntil, null);
  assert.equal(clearPass(FREE_ACCESS), FREE_ACCESS);
  assert.equal(PASS_DURATION_MS, 30 * 24 * 3600 * 1000);
});

/* ---------- читання й збереження ---------- */

test('normalizeAccess: старі формати v1 і v2 не переносяться (не було оплаченого доступу), сміття дає FREE_ACCESS', () => {
  assert.deepEqual(normalizeAccess({ premium: true, credits: 2 }), FREE_ACCESS);
  assert.deepEqual(normalizeAccess({ v: 2, pro: true, credits: 3, unlocks: [] }), FREE_ACCESS);
  for (const bad of [null, undefined, 'x', 5, [], { v: 4 }, {}]) assert.deepEqual(normalizeAccess(bad), FREE_ACCESS);
});

test('normalizeAccess v3: читає коректні значення; погані числа стають null; мітки не з майбутнього відносно lastSeen', () => {
  const ok: AccessState = { v: 3, passUntil: T + 5, lastSeen: T, ad1At: T - 1, rewardAt: null };
  assert.deepEqual(normalizeAccess(ok), ok);
  assert.deepEqual(normalizeAccess({ v: 3, passUntil: 'ні', lastSeen: NaN, ad1At: -5, rewardAt: Infinity }), FREE_ACCESS);
  // нагорода з майбутнього піднімає lastSeen, тож «вічною» вона не стане
  const n = normalizeAccess({ v: 3, passUntil: null, lastSeen: T, ad1At: null, rewardAt: T + 10 * MIN });
  assert.equal(n.lastSeen, T + 10 * MIN);
  assert.equal(rewardAlive(n, T), false);
});

test('збереження доступу: круговий обхід v3, старий запис і зіпсований JSON дають FREE_ACCESS', () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.deepEqual(loadAccess(st), FREE_ACCESS);
  const s = setPass(recordAd1(FREE_ACCESS, T), T + PASS_DURATION_MS, T + 1);
  saveAccess(st, s);
  assert.deepEqual(loadAccess(st), s);
  assert.equal(JSON.parse(mem.get(ACCESS_KEY)!).v, 3);
  mem.set(ACCESS_KEY, JSON.stringify({ premium: true, credits: 1 }));
  assert.deepEqual(loadAccess(st), FREE_ACCESS);
  mem.set(ACCESS_KEY, '{oops');
  assert.deepEqual(loadAccess(st), FREE_ACCESS);
  assert.deepEqual(loadAccess(null), FREE_ACCESS);
});

/* ---------- межі ---------- */

test('Pass і стан доступу ніколи не потрапляють у файл резервної копії', () => {
  const text = serializeBackup([blankCv(), sampleCv()]);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ['app', 'cvs', 'exportedAt', 'version']);
  assert.equal(parsed.app, BACKUP_APP);
  assert.ok(!/"(pro|premium|credits|unlocks|proVerifiedAt|passUntil|lastSeen|ad1At|rewardAt)"/.test(text));
});

test('domain/ без мережі, Capacitor, React і сховища: мережеві виклики лише в monetization/', () => {
  const files = fs.readdirSync('src/domain', { recursive: true, encoding: 'utf8' }).filter((f) => /\.ts$/.test(f));
  assert.ok(files.length > 30);
  for (const f of files) {
    const code = fs.readFileSync(path.join('src/domain', f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|\bWebSocket\b|navigator\.sendBeacon/.test(code), `${f}: мережевий виклик`);
    assert.ok(!/from '@capacitor|from 'react|from 'react-dom/.test(code), `${f}: імпорт Capacitor/React`);
    assert.ok(!/\blocalStorage\b|\bsessionStorage\b/.test(code), `${f}: сховище браузера`);
  }
});
