import type { CvData, DocLang } from './types';
import { printedExtrasText } from './extrasView';
import { ATS_DICTIONARY, tokenize, type AtsEntry, type AtsForm, type AtsKeyword, type Matcher } from './atsDictionary';

export type { AtsKeyword };

/** Коди підказок. Тексти підказок живуть у словниках інтерфейсу, не в domain. */
export type AtsHint = 'too_short' | 'no_keywords' | 'mixed_lang' | 'doc_lang_differs' | 'low_score';

export interface AtsScanResult {
  /** 0–100, орієнтовна оцінка (не гарантія проходження ATS) */
  score: number;
  matched: AtsKeyword[];
  missing: AtsKeyword[];
  jobLang: 'pl' | 'en' | 'mixed';
  hints: AtsHint[];
}

export interface AtsScanOptions {
  /** Мова документа CV: якщо оголошення іншою мовою, додається підказка */
  docLang?: DocLang;
  /** Id шаблону: від нього залежить, які блоки extras/courses друкуються й тому враховуються */
  tpl?: string;
}

/** Довші оголошення обрізаємо: сканер має лишатися швидким на телефоні. */
export const MAX_JOB_CHARS = 20000;
/** Менше слів — оцінка ненадійна. */
export const MIN_JOB_WORDS = 30;
export const LOW_SCORE = 50;

/* ---------- мова оголошення ---------- */

// Службові слова без двозначності (слова, які є в обох мовах, свідомо не беруться).
const PL_MARKERS = new Set([
  'w', 'z', 'na', 'oraz', 'lub', 'dla', 'sie', 'jest', 'nie', 'przy', 'jako', 'czy', 'ktory', 'ktora', 'ktore',
  'wymagania', 'oferujemy', 'poszukujemy', 'mile', 'widziane', 'nasz', 'naszej', 'naszym', 'zespole', 'od', 'ze', 'sa',
  'bedzie', 'bedziesz', 'twoje', 'twoj', 'oferta', 'praca', 'pracy', 'szukamy', 'posiadasz', 'znajomosc', 'wiecej',
]);
const EN_MARKERS = new Set([
  'the', 'and', 'of', 'with', 'for', 'you', 'we', 'are', 'will', 'our', 'your', 'have', 'is', 'be', 'or', 'as', 'at',
  'from', 'this', 'that', 'requirements', 'looking', 'offer', 'ability', 'strong', 'must', 'join',
]);

export function detectJobLang(tokens: readonly string[]): 'pl' | 'en' | 'mixed' {
  let pl = 0;
  let en = 0;
  for (const t of tokens) {
    if (PL_MARKERS.has(t)) pl++;
    else if (EN_MARKERS.has(t)) en++;
  }
  if (pl + en < 3) return 'mixed';
  const share = pl / (pl + en);
  if (share >= 0.8) return 'pl';
  if (share <= 0.2) return 'en';
  return 'mixed';
}

/* ---------- пошук ---------- */

function matchAt(tokens: readonly string[], i: number, pat: readonly Matcher[]): boolean {
  if (i + pat.length > tokens.length) return false;
  for (let j = 0; j < pat.length; j++) {
    const tok = tokens[i + j];
    const m = pat[j];
    if (m.prefix ? !tok.startsWith(m.text) : tok !== m.text) return false;
  }
  return true;
}

/** Скільки разів форма зустрічається в тексті. */
function countForm(tokens: readonly string[], form: AtsForm): number {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (const p of form.patterns) {
      if (matchAt(tokens, i, p)) {
        n++;
        break;
      }
    }
  }
  return n;
}

function entryPresent(tokens: readonly string[], e: AtsEntry): boolean {
  return e.forms.some((f) => countForm(tokens, f) > 0);
}

/**
 * Текст CV для пошуку збігів: назва посади, резюме, досвід, освіта, навички, мови, інтереси
 * і блоки додаткових даних, які друкуються для поточного шаблону (`extrasText`, див. extrasView).
 * Права з поля «prawo jazdy» додаються як слова, щоб оголошення з «prawo jazdy» бачило, що користувач це вказав.
 * Дані, які в документі не друкуються (напр., курси в шаблоні без блоку курсів), не враховуються.
 */
export function cvSearchText(d: CvData, extrasText = ''): string {
  const parts: string[] = [
    d.basics.title,
    d.summary,
    d.skillsHard,
    d.skillsSoft,
    d.interests,
    ...d.experience.flatMap((e) => [e.role, e.company, e.bullets]),
    ...d.education.flatMap((e) => [e.school, e.degree, e.field]),
    ...d.languages.map((l) => l.name),
    extrasText,
  ];
  if (d.basics.license.trim()) parts.push('prawo jazdy driving licence');
  return parts.join('\n');
}

/**
 * Орієнтовна оцінка збігу CV з текстом оголошення.
 * Рахуються лише слова зі словника; оцінка = частка ваги знайдених слів. Це підказка, а не вердикт ATS.
 */
export function scanAts(
  jobText: string,
  data: CvData,
  opts: AtsScanOptions = {},
  dict: readonly AtsEntry[] = ATS_DICTIONARY,
): AtsScanResult {
  const jobTokens = tokenize(String(jobText ?? '').slice(0, MAX_JOB_CHARS));
  const cvTokens = tokenize(cvSearchText(data, printedExtrasText({ tpl: opts.tpl ?? '', lang: opts.docLang ?? 'pl', data })));
  const jobLang = detectJobLang(jobTokens);

  const matched: AtsKeyword[] = [];
  const missing: AtsKeyword[] = [];

  for (const e of dict) {
    // Знаходимо форму, яка найчастіше трапляється в оголошенні; її й показуємо користувачу.
    let best: AtsForm | null = null;
    let bestCount = 0;
    let total = 0;
    for (const f of e.forms) {
      const c = countForm(jobTokens, f);
      total += c;
      if (c > bestCount) {
        best = f;
        bestCount = c;
      }
    }
    if (!best) continue;

    // Слово, яке повторюється в оголошенні, важливіше.
    const weight = e.weight + (total >= 2 ? 1 : 0);
    const kw: AtsKeyword = { stem: e.stem, display: best.display, kind: e.kind, weight };
    if (e.addTo) kw.addTo = e.addTo;
    (entryPresent(cvTokens, e) ? matched : missing).push(kw);
  }

  const byWeight = (a: AtsKeyword, b: AtsKeyword) => b.weight - a.weight || a.display.localeCompare(b.display);
  matched.sort(byWeight);
  missing.sort(byWeight);

  const sum = (l: AtsKeyword[]) => l.reduce((s, k) => s + k.weight, 0);
  const all = sum(matched) + sum(missing);
  const score = all === 0 ? 0 : Math.round((sum(matched) / all) * 100);

  const hints: AtsHint[] = [];
  if (jobTokens.length < MIN_JOB_WORDS) hints.push('too_short');
  if (matched.length + missing.length === 0) hints.push('no_keywords');
  else if (score < LOW_SCORE) hints.push('low_score');
  if (jobLang === 'mixed' && jobTokens.length >= MIN_JOB_WORDS) hints.push('mixed_lang');
  if (opts.docLang && jobLang !== 'mixed' && jobLang !== opts.docLang) hints.push('doc_lang_differs');

  return { score, matched, missing, jobLang, hints };
}
