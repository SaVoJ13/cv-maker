import type { Cv } from './types';

/** Małe litery bez znaków diakrytycznych: „Łódź" pasuje do „lodz". */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ł/gi, 'l')
    .toLowerCase();
}

/** Czy CV pasuje do wpisanej frazy (każde słowo musi się pojawić w nazwie wersji, imieniu, stanowisku lub szablonie). */
export function matchesCv(cv: Cv, query: string, templateName: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fold([cv.name, cv.data.basics.name, cv.data.basics.title, templateName].join(' '));
  return words.every((w) => hay.includes(w));
}

export type SortKey = 'recent' | 'name';

export function sortCvs<T extends Pick<Cv, 'name' | 'updated'>>(items: readonly T[], key: SortKey, locale: string): T[] {
  const copy = items.slice();
  if (key === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }) || b.updated - a.updated);
  return copy.sort((a, b) => b.updated - a.updated);
}
