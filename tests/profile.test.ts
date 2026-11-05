import test from 'node:test';
import assert from 'node:assert/strict';
import { MONETIZATION } from '../src/monetization/config.ts';
import { assertProductionConfig, configProblems, profileFromMode, type MonetizationConfig } from '../src/monetization/profile.ts';

const GOOD: MonetizationConfig = { gatingEnabled: true, adsEnabled: true, testAds: false, admobAppId: 'ca-app-pub-1~2', rewardedAdUnitId: 'ca-app-pub-1/3' };

test('profileFromMode: dev і closed як є; все інше (у т.ч. production, невідоме) — production', () => {
  assert.equal(profileFromMode('dev'), 'dev');
  assert.equal(profileFromMode('closed'), 'closed');
  assert.equal(profileFromMode('production'), 'production');
  assert.equal(profileFromMode('qwe'), 'production');
});

test('production: testAds:true провалюється, testAds:false проходить', () => {
  assert.deepEqual(configProblems('production', GOOD), []);
  assert.equal(configProblems('production', { ...GOOD, testAds: true }).length, 1);
  assert.throws(() => assertProductionConfig({ ...GOOD, testAds: true }), /testAds/);
  assert.doesNotThrow(() => assertProductionConfig(GOOD));
});

test('closed дозволяє testAds:true, але вимагає замок і реклами; dev без вимог', () => {
  assert.deepEqual(configProblems('closed', { ...GOOD, testAds: true }), []);
  assert.equal(configProblems('closed', { ...GOOD, gatingEnabled: false }).length, 1);
  assert.equal(configProblems('closed', { ...GOOD, adsEnabled: false }).length, 1);
  assert.deepEqual(configProblems('dev', { ...GOOD, testAds: true, gatingEnabled: false, adsEnabled: false }), []);
});

test('production: тестові ідентифікатори Google забороняються', () => {
  const bad = { ...GOOD, rewardedAdUnitId: 'ca-app-pub-3940256099942544/5224354917' };
  assert.equal(configProblems('production', bad).length, 1);
  assert.deepEqual(configProblems('closed', bad), []);
});

test('поточна конфігурація підходить для closed і dev (для production — лише коли testAds: false, крок 5c)', () => {
  assert.deepEqual(configProblems('closed', MONETIZATION), []);
  assert.deepEqual(configProblems('dev', MONETIZATION), []);
  assert.equal(configProblems('production', MONETIZATION).length > 0, MONETIZATION.testAds);
});
