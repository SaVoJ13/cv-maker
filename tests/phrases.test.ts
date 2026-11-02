import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PHRASES, findPhrase, missingCoverage, phrasesFor, validatePhrases } from '../src/domain/phrases/index.ts';
import type { Phrase } from '../src/domain/phrases/types.ts';

const mk = (over: Partial<Phrase> = {}): Phrase => ({
  id: 'x1',
  industry: 'it',
  section: 'summary',
  title: { pl: 'a', uk: 'б', en: 'c' },
  text: { pl: 'tekst', en: 'text' },
  ...over,
});

test('phrasesFor і findPhrase фільтрують за галуззю, розділом та id', () => {
  const list = [mk({ id: 'a' }), mk({ id: 'b', section: 'skills' }), mk({ id: 'c', industry: 'office' })];
  assert.deepEqual(phrasesFor('it', 'summary', list).map((p) => p.id), ['a']);
  assert.equal(findPhrase('b', list)?.section, 'skills');
  assert.equal(findPhrase('zzz', list), undefined);
});

test('validatePhrases ловить дублі, порожні переклади й переноси в summary/skills', () => {
  assert.deepEqual(validatePhrases([mk({ id: 'a' }), mk({ id: 'b' })]), []);
  assert.ok(validatePhrases([mk({ id: 'a' }), mk({ id: 'a' })]).some((s) => s.includes('дубль')));
  assert.ok(validatePhrases([mk({ title: { pl: 'a', uk: '', en: 'c' } })]).some((s) => s.includes('title.uk')));
  assert.ok(validatePhrases([mk({ text: { pl: 'a\nb', en: 'c' } })]).some((s) => s.includes('перенос')));
  assert.deepEqual(validatePhrases([mk({ section: 'experience', text: { pl: 'a\nb', en: 'c\nd' } })]), []);
});

test('missingCoverage показує розділи, де фраз менше мінімуму', () => {
  const r = missingCoverage([mk()], 1);
  assert.ok(!r.some((s) => s.startsWith('it/summary')));
  assert.ok(r.some((s) => s.startsWith('it/skills')));
});

test('набір фраз: валідний, у кожній галузі й розділі не менше 4, разом близько 100', () => {
  assert.deepEqual(validatePhrases(ALL_PHRASES), []);
  assert.deepEqual(missingCoverage(ALL_PHRASES, 4), []);
  assert.ok(ALL_PHRASES.length >= 96, String(ALL_PHRASES.length));
});

test('фрази нейтральні: без цифр і тверджень про сертифікати, права, допуски', () => {
  const banned = /\d|certyfikat|uprawnieni|licencj|prawo jazdy|certificate|licen[cs]e|permit|qualified|certified|\bADR\b|\bUDT\b|\bSEP\b/i;
  for (const p of ALL_PHRASES)
    for (const l of ['pl', 'en'] as const) assert.ok(!banned.test(p.text[l]), `${p.id}: ${p.text[l]}`);
});

test('фрази experience: один пункт на фразу, без переносів рядка', () => {
  for (const p of ALL_PHRASES.filter((x) => x.section === 'experience'))
    for (const l of ['pl', 'en'] as const) assert.ok(!p.text[l].includes('\n'), p.id);
});
