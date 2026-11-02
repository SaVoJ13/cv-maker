import type { DocLang, UiLang } from '../types';
import { CONSTRUCTION } from './construction';
import { DRIVERS } from './drivers';
import { IT } from './it';
import { LOGISTICS } from './logistics';
import { OFFICE } from './office';
import { PRODUCTION_CNC } from './production_cnc';
import { RETAIL_FOOD } from './retail_food';
import { STUDENTS } from './students';
import { INDUSTRY_IDS, PHRASE_SECTIONS, type IndustryId, type Phrase, type PhraseSection } from './types';

export { INDUSTRY_IDS, PHRASE_SECTIONS };
export type { IndustryId, Phrase, PhraseSection };

/** Усі фрази. Файли галузей підключаються тут. */
export const ALL_PHRASES: readonly Phrase[] = [
  ...LOGISTICS,
  ...DRIVERS,
  ...CONSTRUCTION,
  ...PRODUCTION_CNC,
  ...IT,
  ...OFFICE,
  ...RETAIL_FOOD,
  ...STUDENTS,
];

export function phrasesFor(
  industry: IndustryId,
  section: PhraseSection,
  list: readonly Phrase[] = ALL_PHRASES,
): Phrase[] {
  return list.filter((p) => p.industry === industry && p.section === section);
}

export function findPhrase(id: string, list: readonly Phrase[] = ALL_PHRASES): Phrase | undefined {
  return list.find((p) => p.id === id);
}

const UI_LANGS: UiLang[] = ['pl', 'uk', 'en'];
const DOC_LANGS: DocLang[] = ['pl', 'en'];

/** Перевірка набору фраз: повертає список проблем (порожній = усе гаразд). */
export function validatePhrases(list: readonly Phrase[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const p of list) {
    if (!p.id) problems.push('порожній id');
    if (seen.has(p.id)) problems.push(`дубль id: ${p.id}`);
    seen.add(p.id);
    if (!INDUSTRY_IDS.includes(p.industry)) problems.push(`${p.id}: невідома галузь`);
    if (!PHRASE_SECTIONS.includes(p.section)) problems.push(`${p.id}: невідомий розділ`);
    for (const l of UI_LANGS) if (!p.title?.[l]?.trim()) problems.push(`${p.id}: немає title.${l}`);
    for (const l of DOC_LANGS) if (!p.text?.[l]?.trim()) problems.push(`${p.id}: немає text.${l}`);
    // skills вставляються через кому, тому в тексті не має бути переносів і ком усередині одного пункту — перевіряємо лише переноси
    if (p.section !== 'experience') {
      for (const l of DOC_LANGS) if (/\n/.test(p.text?.[l] ?? '')) problems.push(`${p.id}: перенос рядка в text.${l}`);
    }
  }
  return problems;
}

/** Галузі/розділи, у яких бракує фраз (для тесту повноти набору). */
export function missingCoverage(list: readonly Phrase[] = ALL_PHRASES, min = 3): string[] {
  const out: string[] = [];
  for (const i of INDUSTRY_IDS)
    for (const s of PHRASE_SECTIONS) {
      const n = phrasesFor(i, s, list).length;
      if (n < min) out.push(`${i}/${s}: ${n}`);
    }
  return out;
}
