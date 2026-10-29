import type { Cv } from './types';
import { filledEducation, filledExperience, filledLanguages, list } from './cvOps';

/** Sekcje formularza w kolejności wypełniania. */
export const SECTION_IDS = ['basics', 'photo', 'extra', 'summary', 'exp', 'edu', 'skills', 'lang', 'interests', 'rodo'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Czy sekcja ma jakąkolwiek treść (do kropek „wypełnione" w edytorze). Sekcje z samymi ustawieniami (RODO) liczymy jako gotowe. */
export function sectionFilled(cv: Cv, id: SectionId): boolean {
  const d = cv.data;
  const b = d.basics;
  switch (id) {
    case 'basics':
      return Boolean(b.name.trim() && (b.email.trim() || b.phone.trim()));
    case 'photo':
      return Boolean(b.photo);
    case 'extra':
      return Boolean(b.address.trim() || b.birthDate.trim() || b.birthPlace.trim() || b.license.trim());
    case 'summary':
      return Boolean(d.summary.trim());
    case 'exp':
      return filledExperience(d).length > 0;
    case 'edu':
      return filledEducation(d).length > 0;
    case 'skills':
      return list(d.skillsHard).length + list(d.skillsSoft).length > 0;
    case 'lang':
      return filledLanguages(d).length > 0;
    case 'interests':
      return Boolean(d.interests.trim());
    case 'rodo':
      return true;
  }
}

/** Sekcje, które liczymy do paska postępu na pulpicie (pozostałe są dobrowolne). */
export const CORE_SECTIONS: readonly SectionId[] = ['basics', 'summary', 'exp', 'edu', 'skills', 'lang'];

export function completeness(cv: Cv): { done: number; total: number } {
  const done = CORE_SECTIONS.filter((id) => sectionFilled(cv, id)).length;
  return { done, total: CORE_SECTIONS.length };
}

/** Nic jeszcze nie wpisano (poza ustawieniami i klauzulą RODO): podgląd pokazuje wtedy wzór z danymi przykładowymi. */
export function isBlank(cv: Cv): boolean {
  const b = cv.data.basics;
  if ([b.name, b.title, b.email, b.phone, b.city, b.link].some((v) => v.trim())) return false;
  return SECTION_IDS.every((id) => id === 'rodo' || id === 'basics' || !sectionFilled(cv, id));
}
