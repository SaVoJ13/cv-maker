import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FREE_ACCESS, resetAccess } from '../src/domain/access.ts';
import { ACCESS_KEY, saveAccess } from '../src/store/accessPersist.ts';

test('resetAccess: passUntil, lastSeen, ad1At, rewardAt скинуті до порожнього стану', () => {
  assert.deepEqual(resetAccess(), { v: 3, passUntil: null, lastSeen: 0, ad1At: null, rewardAt: null, granted: [] });
  assert.equal(resetAccess(), FREE_ACCESS);
});

test('скидання пише лише в cvmaker.access: CV, згода UMP та інші ключі не змінюються', () => {
  const data = new Map<string, string>([
    ['cvmaker.state', '{"cvs":[1]}'],
    ['IABTCF_TCString', 'consent'],
    [ACCESS_KEY, JSON.stringify({ v: 3, passUntil: 9e12, lastSeen: 5, ad1At: 4, rewardAt: 3 })],
  ]);
  const before = new Map(data);
  saveAccess({ setItem: (k, v) => void data.set(k, v) }, resetAccess());
  for (const [k, v] of before) if (k !== ACCESS_KEY) assert.equal(data.get(k), v, k);
  assert.deepEqual(JSON.parse(data.get(ACCESS_KEY)!), resetAccess());
  assert.equal(data.size, before.size);
});

test('кнопка розробника: імпорт у Settings лише під перевіркою dev, підпис польською не у словниках', () => {
  const settings = readFileSync('src/components/Settings.tsx', 'utf8');
  assert.match(settings, /import\.meta\.env\.DEV \|\| import\.meta\.env\.MODE === 'dev'\s*\?\s*lazy\(\(\) => import\('\.\.\/monetization\/DevResetButton'\)/);
  assert.doesNotMatch(settings, /^import .*DevResetButton/m);
  for (const l of ['pl', 'uk', 'en']) assert.doesNotMatch(readFileSync(`src/domain/i18n/${l}.ts`, 'utf8'), /Resetuj Pass i reklamy/);
});

test('check:prod знаходить кнопку розробника та заглушки у файлах збірки', async () => {
  const mod = (await import('../scripts/check-prod.mjs' as string)) as {
    findForbidden: (f: string[], r: (p: string) => string) => Array<{ mark: string }>;
  };
  const files: Record<string, string> = {
    'ok.js': 'console.log("CV")',
    'bad1.js': 'x="CVMAKER_DEV_RESET_BUTTON_DEV_ONLY"',
    'bad2.js': 'y="Resetuj Pass i reklamy"',
    'bad3.js': 'CVMAKER_STUB_BILLING_DEV_ONLY',
  };
  const hits = mod.findForbidden(Object.keys(files), (p) => files[p]);
  assert.deepEqual(hits.map((h) => h.mark).sort(), ['CVMAKER_DEV_RESET_BUTTON_DEV_ONLY', 'CVMAKER_STUB_BILLING_DEV_ONLY', 'Resetuj Pass i reklamy']);
});
