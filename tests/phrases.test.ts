import test from 'node:test';
import assert from 'node:assert/strict';
import { findPhrase, missingCoverage, phrasesFor, validatePhrases } from '../src/domain/phrases/index.ts';
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
