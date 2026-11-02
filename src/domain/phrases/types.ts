import type { DocLang, IndustryId, UiLang } from '../types';

export type { IndustryId };

/** Розділ CV, у який вставляється фраза. */
export type PhraseSection = 'summary' | 'experience' | 'skills';

export const PHRASE_SECTIONS: readonly PhraseSection[] = ['summary', 'experience', 'skills'];

export const INDUSTRY_IDS: readonly IndustryId[] = [
  'logistics',
  'drivers',
  'construction',
  'production_cnc',
  'it',
  'office',
  'retail_food',
  'students',
];

/**
 * Готова фраза. Назва показується мовою інтерфейсу, текст вставляється мовою документа.
 * Фрази нейтральні: не стверджують сертифікатів, прав, допусків чи конкретних цифр.
 */
export interface Phrase {
  id: string;
  industry: IndustryId;
  section: PhraseSection;
  title: Record<UiLang, string>;
  text: Record<DocLang, string>;
}
