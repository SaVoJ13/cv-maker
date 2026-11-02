import type { IndustryId, Phrase, PhraseSection } from './types';

/** Скорочений конструктор фраз: title = [pl, uk, en], text = [pl, en]. */
export function group(industry: IndustryId, section: PhraseSection) {
  return (n: number, title: [string, string, string], text: [string, string]): Phrase => ({
    id: `${industry}.${section}.${n}`,
    industry,
    section,
    title: { pl: title[0], uk: title[1], en: title[2] },
    text: { pl: text[0], en: text[1] },
  });
}
