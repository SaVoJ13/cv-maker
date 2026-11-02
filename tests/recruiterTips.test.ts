import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneHasCountryCode, recruiterTips } from '../src/domain/quality.ts';
import { blankCv, newExperience } from '../src/domain/cvOps.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import type { Cv } from '../src/domain/types.ts';

const ids = (cv: Cv) => recruiterTips(cv).map((t) => t.id);

test('phoneHasCountryCode: +<код> і 00<код> нормальні для будь-якої країни', () => {
  for (const ok of ['+48 600 100 200', '+380 67 123 45 67', '+49 30 1234567', ' +44 7700 900123', '0048600100200', '(+48) 600 100 200', '+ 48 600100200'])
    assert.equal(phoneHasCountryCode(ok), true, ok);
  for (const bad of ['600 100 200', '600100200', '(22) 123 45 67', '048 600', '', 'abc'])
    assert.equal(phoneHasCountryCode(bad), false, bad);
});

test('телефон: не-польський код — не помилка; без коду — м’яка підказка; порожній — без підказки', () => {
  const cv = blankCv();
  cv.data.basics.phone = '+380 67 123 45 67';
  assert.ok(!ids(cv).includes('phone_code'));
  cv.data.basics.phone = '+48 600 100 200';
  assert.ok(!ids(cv).includes('phone_code'));
  cv.data.basics.phone = '600 100 200';
  const tip = recruiterTips(cv).find((t) => t.id === 'phone_code');
  assert.equal(tip?.tone, 'warn');
  cv.data.basics.phone = '   ';
  assert.ok(!ids(cv).includes('phone_code'));
});

test('цифри в досвіді: показуємо місця без жодної цифри, не чіпаємо повні й порожні', () => {
  const cv = blankCv();
  const a = newExperience();
  a.role = 'Magazynier';
  a.company = 'Firma A';
  a.bullets = 'Kompletacja zamówień\nObsługa WMS';
  const b = newExperience();
  b.role = 'Kierowca';
  b.bullets = 'Przewóz towarów\nObsługa 15 klientów dziennie';
  const c = newExperience(); // порожній запис
  const d = newExperience();
  d.company = 'Firma D';
  d.bullets = ''; // без пунктів: не рахується
  cv.data.experience = [a, b, c, d];
  const tip = recruiterTips(cv).find((t) => t.id === 'metrics_where');
  assert.ok(tip);
  assert.deepEqual(tip.places, [{ index: 0, role: 'Magazynier', company: 'Firma A' }]);

  b.bullets = 'Przewóz towarów';
  assert.equal(recruiterTips(cv).find((t) => t.id === 'metrics_where')?.places?.length, 2);

  a.bullets = 'Obsługa 3 magazynów';
  b.bullets = 'Przewóz 200 palet';
  assert.ok(!ids(cv).includes('metrics_where'));
});

test('довідка про art. 22¹ показується завжди й має тон info; приклад CV без телефонних проблем', () => {
  const tip = recruiterTips(blankCv()).find((t) => t.id === 'law_22_1');
  assert.equal(tip?.tone, 'info');
});

test('тексти порад: усі ключі є в PL/UA/EN, довідка про закон має підпис «не юридична порада»', () => {
  const keys = ['rec_title', 'rec_phone_code', 'rec_metrics_intro', 'rec_metrics_note', 'rec_law_title', 'rec_law', 'rec_law_disclaimer'] as const;
  for (const lang of ['pl', 'uk', 'en'] as const)
    for (const k of keys) assert.ok((MESSAGES[lang] as Record<string, string>)[k]?.length > 5, `${lang}/${k}`);
  assert.match(MESSAGES.pl.rec_law_disclaimer, /nie jest porad[ąa] prawn/i);
  assert.match(MESSAGES.uk.rec_law_disclaimer, /не юридична порада/);
  assert.match(MESSAGES.en.rec_law_disclaimer, /not legal advice/i);
  for (const lang of ['pl', 'uk', 'en'] as const) assert.match(MESSAGES[lang].rec_law, /22/);
  assert.match(MESSAGES.uk.rec_phone_code, /\+48/);
});
