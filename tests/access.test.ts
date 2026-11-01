import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_ACCESS,
  consumeToken,
  decideFeature,
  decideTemplate,
  grantToken,
  normalizeAccess,
  pruneTokens,
  setPro,
  type FeatureCtx,
  type ProState,
} from '../src/domain/access.ts';
import { FEATURE_IDS, FEATURE_TIER, FREE_LIMITS, canAddCv, isFeatureId, ownCvCount } from '../src/domain/features.ts';
import { BACKUP_APP, serializeBackup } from '../src/domain/backup.ts';
import { blankCv, sampleCv } from '../src/domain/cvOps.ts';
import { ACCESS_KEY, loadAccess, saveAccess } from '../src/store/accessPersist.ts';

const ctx = (over: Partial<FeatureCtx> = {}): FeatureCtx => ({ gated: true, now: 1000, ...over });

test('features: кожна функція має рівень, isFeatureId розпізнає лише відомі', () => {
  for (const f of FEATURE_IDS) assert.ok(FEATURE_TIER[f] === 'free' || FEATURE_TIER[f] === 'pro', f);
  assert.equal(isFeatureId('qr'), true);
  assert.equal(isFeatureId('qrr'), false);
  assert.equal(isFeatureId(5), false);
});

test('ліміт Free: 2 власні CV, приклад не рахується, старі понад ліміт лишаються', () => {
  const own = (n: number) => Array.from({ length: n }, () => blankCv());
  assert.equal(FREE_LIMITS.maxCvs, 2);
  assert.equal(ownCvCount([sampleCv(), ...own(1)]), 1);
  assert.equal(canAddCv([sampleCv(), ...own(1)], false), true);
  assert.equal(canAddCv(own(2), false), false);
  assert.equal(canAddCv(own(5), false), false); // у когось вже 5: нових не можна, але й не видаляємо
  assert.equal(canAddCv(own(5), true), true);
});

test('decideFeature: вимкнена реклама відкриває все; PRO і токени; інакше locked', () => {
  assert.equal(decideFeature(FREE_ACCESS, 'qr', ctx({ gated: false })), 'free');
  assert.equal(decideFeature(FREE_ACCESS, 'qr', ctx()), 'locked');
  assert.equal(decideFeature(setPro(FREE_ACCESS, true, 5), 'qr', ctx()), 'pro');
  const withToken = grantToken(FREE_ACCESS, { feature: 'ats_scan', uses: null, expiresAt: 2000 });
  assert.equal(decideFeature(withToken, 'ats_scan', ctx()), 'token');
  assert.equal(decideFeature(withToken, 'qr', ctx()), 'locked');
  assert.equal(decideFeature(withToken, 'ats_scan', ctx({ now: 2000 })), 'locked'); // термін вийшов
});

test('токен для конкретного CV не діє на інше CV', () => {
  const s = grantToken(FREE_ACCESS, { feature: 'autofit', cvId: 'a', uses: 1, expiresAt: null });
  assert.equal(decideFeature(s, 'autofit', ctx({ cvId: 'a' })), 'token');
  assert.equal(decideFeature(s, 'autofit', ctx({ cvId: 'b' })), 'locked');
  assert.equal(decideFeature(s, 'autofit', ctx()), 'locked');
});

test('consumeToken: разовий зникає, багаторазовий зменшується, безкінечний лишається', () => {
  let s = grantToken(FREE_ACCESS, { feature: 'cover_letter', uses: 1, expiresAt: null });
  s = consumeToken(s, 'cover_letter', ctx());
  assert.equal(s.unlocks.length, 0);
  s = grantToken(FREE_ACCESS, { feature: 'cover_letter', uses: 2, expiresAt: null });
  s = consumeToken(s, 'cover_letter', ctx());
  assert.equal(s.unlocks[0]?.uses, 1);
  s = grantToken(FREE_ACCESS, { feature: 'ats_scan', uses: null, expiresAt: 5000 });
  assert.equal(consumeToken(s, 'ats_scan', ctx()).unlocks.length, 1);
  assert.equal(consumeToken(FREE_ACCESS, 'qr', ctx()), FREE_ACCESS); // нічого витрачати
});

test('pruneTokens: прибирає прострочені, не чіпає діючі', () => {
  let s: ProState = grantToken(FREE_ACCESS, { feature: 'qr', uses: null, expiresAt: 500 });
  s = grantToken(s, { feature: 'phrases', uses: null, expiresAt: 5000 });
  const p = pruneTokens(s, 1000);
  assert.deepEqual(p.unlocks.map((t) => t.feature), ['phrases']);
  assert.equal(pruneTokens(p, 1000), p);
});

test('decideTemplate: безкоштовні шаблони завжди, PRO-шаблони лише з доступом', () => {
  for (const k of ['classic', 'minimal', 'ats', 'industrial'] as const) {
    assert.equal(decideTemplate(FREE_ACCESS, k, ctx()), 'free', k);
  }
  assert.equal(decideTemplate(FREE_ACCESS, 'modern', ctx()), 'locked');
  assert.equal(decideTemplate(FREE_ACCESS, 'modern', ctx({ gated: false })), 'free');
  assert.equal(decideTemplate(setPro(FREE_ACCESS, true, 1), 'nordic', ctx()), 'pro');
});

test('normalizeAccess: старий формат v1 переноситься, v2 читається, сміття відкидається', () => {
  assert.deepEqual(normalizeAccess({ premium: true, credits: 2 }, 3), { ...FREE_ACCESS, pro: true, credits: 2 });
  const raw = {
    v: 2,
    pro: true,
    proVerifiedAt: 123,
    credits: 1,
    unlocks: [
      { feature: 'qr', uses: 1, expiresAt: null, cvId: 'x' },
      { feature: 'нема', uses: 1, expiresAt: null },
      { feature: 'qr', uses: -3, expiresAt: null },
      { feature: 'qr', uses: 1, expiresAt: 'завтра' },
      7,
    ],
  };
  const s = normalizeAccess(raw, 3);
  assert.equal(s.pro, true);
  assert.equal(s.proVerifiedAt, 123);
  assert.deepEqual(s.unlocks, [{ feature: 'qr', cvId: 'x', uses: 1, expiresAt: null }]);
  // PRO не береться з поля premium у v2, а без PRO немає й часу перевірки
  assert.equal(normalizeAccess({ v: 2, premium: true }, 3).pro, false);
  assert.equal(normalizeAccess({ v: 2, pro: false, proVerifiedAt: 5 }, 3).proVerifiedAt, null);
});

test('збереження доступу: круговий обхід v2 і читання старого запису', () => {
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  mem.set(ACCESS_KEY, JSON.stringify({ premium: true, credits: 1 }));
  const old = loadAccess(st, 3);
  assert.equal(old.pro, true);
  saveAccess(st, old);
  assert.deepEqual(loadAccess(st, 3), old);
  assert.equal(JSON.parse(mem.get(ACCESS_KEY)!).v, 2);
});

test('PRO-статус ніколи не потрапляє у файл резервної копії', () => {
  const text = serializeBackup([blankCv(), sampleCv()]);
  const parsed = JSON.parse(text) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), ['app', 'cvs', 'exportedAt', 'version']);
  assert.equal(parsed.app, BACKUP_APP);
  assert.ok(!/"(pro|premium|credits|unlocks|proVerifiedAt)"/.test(text));
});
