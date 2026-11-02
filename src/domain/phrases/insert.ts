import { list } from '../cvOps';
import type { Phrase, PhraseSection } from './types';
import type { DocLang } from '../types';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Вставка фрази в поточний текст поля. Повертає новий текст.
 * - summary: у кінець новим абзацом;
 * - experience: пункт на окремому рядку (формат bullets);
 * - skills: через кому, без дублікатів.
 * Повторна вставка тієї самої фрази текст не змінює.
 */
export function insertText(section: PhraseSection, current: string, text: string): string {
  const add = text.trim();
  const cur = current ?? '';
  if (!add) return cur;

  if (section === 'summary') {
    if (norm(cur).includes(norm(add))) return cur;
    return cur.trim() ? `${cur.trimEnd()}\n\n${add}` : add;
  }

  if (section === 'experience') {
    const lines = cur.split('\n').map((l) => norm(l));
    if (lines.includes(norm(add))) return cur;
    return cur.trim() ? `${cur.trimEnd()}\n${add}` : add;
  }

  // skills
  const have = list(cur);
  const seen = new Set(have.map(norm));
  const fresh = list(add).filter((x) => {
    const k = norm(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (fresh.length === 0) return cur;
  return [...have, ...fresh].join(', ');
}

export function insertPhrase(current: string, phrase: Phrase, lang: DocLang): string {
  return insertText(phrase.section, current, phrase.text[lang]);
}

/** Чи фраза вже є в тексті (для позначки «додано» у списку). */
export function isInserted(current: string, phrase: Phrase, lang: DocLang): boolean {
  return insertPhrase(current, phrase, lang) === current;
}
