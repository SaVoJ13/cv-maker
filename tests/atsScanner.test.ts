import test from 'node:test';
import assert from 'node:assert/strict';
import { ATS_DICTIONARY, GENERIC_WORDS, normalizeText, tokenize, validateDictionary } from '../src/domain/atsDictionary.ts';
import { cvSearchText, detectJobLang, scanAts } from '../src/domain/atsScanner.ts';
import { blankCv } from '../src/domain/cvOps.ts';
import { insertText } from '../src/domain/phrases/insert.ts';
import type { CvData } from '../src/domain/types.ts';

const cv = (over: Partial<CvData> = {}): CvData => ({ ...blankCv().data, ...over });
const names = (r: ReturnType<typeof scanAts>) => [...r.matched, ...r.missing].map((k) => k.display);

// Оголошення, повне загальних слів, але майже без справжніх ключових.
const GENERIC_AD = `Firma poszukuje pracownika. Oferujemy stabilną pracę, atrakcyjną ofertę i wynagrodzenie.
Wymagania: doświadczenie, znajomość branży, umiejętności komunikacyjne w zespole. Zadania i obowiązki na stanowisku.
Aplikuj teraz! Company offers a great job. Requirements: experience, knowledge, skills, team, role, candidate, position.`;

test('словник валідний: без загальних слів, коротких основ і дублів', () => {
  assert.deepEqual(validateDictionary(), []);
  assert.ok(ATS_DICTIONARY.length >= 100, String(ATS_DICTIONARY.length));
});

test('вимоги (права, допуски, мови) не мають addTo, навички мають', () => {
  for (const e of ATS_DICTIONARY) {
    if (e.kind === 'requirement') assert.equal(e.addTo, undefined, e.stem);
    if (e.kind === 'hard') assert.equal(e.addTo, 'skillsHard', e.stem);
    if (e.kind === 'soft') assert.equal(e.addTo, 'skillsSoft', e.stem);
  }
});

test('загальні слова («praca», «firma», «oferta» тощо) не стають ключовими', () => {
  const r = scanAts(GENERIC_AD, cv());
  const found = names(r).map((s) => normalizeText(s));
  for (const g of ['praca', 'firma', 'oferta', 'experience', 'team', 'job', 'company', 'wynagrodzenie']) {
    assert.ok(!found.some((f) => f.split(/\s+/).includes(g)), `загальне слово «${g}» у результаті: ${found.join(', ')}`);
  }
  for (const k of [...r.matched, ...r.missing]) assert.ok(!GENERIC_WORDS.includes(normalizeText(k.display)), k.display);
});

test('текст лише із загальних слів: 0 слів, оцінка 0, підказка no_keywords', () => {
  const r = scanAts('Firma oferuje pracę. Oferta pracy, wymagania, doświadczenie, stanowisko, zespół. Company job offer, experience, team, role.', cv());
  assert.deepEqual(names(r), []);
  assert.equal(r.score, 0);
  assert.ok(r.hints.includes('no_keywords'));
});

test('порожнє оголошення: 0 і підказки too_short та no_keywords, без падіння', () => {
  const r = scanAts('', cv());
  assert.equal(r.score, 0);
  assert.deepEqual([...r.hints].sort(), ['no_keywords', 'too_short']);
  assert.doesNotThrow(() => scanAts(undefined as unknown as string, cv()));
});

test('розрахунок: вага hard = 3, оцінка = частка ваги знайдених', () => {
  const r = scanAts('SQL oraz Docker', cv({ skillsHard: 'SQL, Excel' }));
  assert.deepEqual(r.matched.map((k) => k.display), ['SQL']);
  assert.deepEqual(r.missing.map((k) => k.display), ['Docker']);
  assert.equal(r.score, 50);
  assert.equal(r.missing[0].addTo, 'skillsHard');
});

test('слово, що повторюється в оголошенні, важить більше, але рахується один раз', () => {
  const r = scanAts('Docker, Docker i jeszcze raz Docker', cv());
  assert.equal(r.missing.length, 1);
  assert.equal(r.missing[0].weight, 4);
});

test('польська флексія та діакритика: «wózków widłowych» = «WOZEK WIDLOWY»', () => {
  const r = scanAts('Obsługa wózków widłowych oraz kompletacji zamówień', cv({ skillsHard: 'WOZEK WIDLOWY, kompletacja' }));
  assert.deepEqual(r.matched.map((k) => k.display).sort(), ['Kompletacja zamówień', 'Wózek widłowy']);
  assert.equal(r.score, 100);
});

test('змішане оголошення: польський текст з англійськими термінами лишається pl і знаходить терміни', () => {
  const ad = `Szukamy Full-Stack Developera do naszego zespołu. Wymagania: React, TypeScript, Node.js, znajomość SQL oraz Docker.
Mile widziane: Kubernetes i CI/CD. Oferujemy pracę w zespole, elastyczne godziny i rozwój. Jeśli to Ty, aplikuj!`;
  const r = scanAts(ad, cv({ skillsHard: 'TypeScript, React, SQL, Git' }), { docLang: 'en' });
  assert.equal(r.jobLang, 'pl');
  const hard = [...r.matched, ...r.missing].filter((k) => k.kind === 'hard');
  assert.deepEqual(r.matched.filter((k) => k.kind === 'hard').map((k) => k.display).sort(), ['React', 'SQL', 'TypeScript']);
  for (const m of ['Docker', 'Kubernetes', 'Node.js', 'CI/CD']) assert.ok(r.missing.some((k) => k.display === m), m);
  assert.equal(hard.length, 7);
  assert.ok(r.hints.includes('doc_lang_differs'));
});

test('двомовне оголошення (PL + EN) визначається як mixed і дає підказку', () => {
  const ad = `Szukamy osoby do pracy w magazynie. Wymagania: obsługa wózka widłowego oraz znajomość WMS. Oferujemy stabilne zatrudnienie dla osób, które są punktualne.
We are looking for a warehouse operator. Requirements: forklift experience and WMS knowledge. We offer a stable job for you and our team, and you will have the tools that are needed.`;
  const r = scanAts(ad, cv());
  assert.equal(r.jobLang, 'mixed');
  assert.ok(r.hints.includes('mixed_lang'));
  assert.equal(r.hints.includes('doc_lang_differs'), false);
  // WMS і wózek/forklift — по одному поняттю, хоч названі двічі різними мовами
  assert.equal([...r.matched, ...r.missing].filter((k) => k.display === 'WMS').length, 1);
  assert.equal([...r.matched, ...r.missing].filter((k) => k.stem === 'woze widlow').length, 1);
});

test('різні мови: польське «wózek widłowy» в оголошенні і «forklift» у CV — це збіг', () => {
  const r = scanAts('Wymagana obsługa wózków widłowych', cv({ skillsHard: 'Forklift operation' }));
  assert.equal(r.matched.length, 1);
  assert.equal(r.matched[0].display, 'Wózek widłowy');
  const back = scanAts('Forklift operator required', cv({ skillsHard: 'obsługa wózka widłowego' }));
  assert.equal(back.matched[0].display, 'Forklift');
});

test('відображення береться з тієї форми, що є в оголошенні (мова оголошення)', () => {
  assert.equal(scanAts('order picking and packing', cv()).missing.some((k) => k.display === 'Order picking'), true);
  assert.equal(scanAts('kompletacja i pakowanie', cv()).missing.some((k) => k.display === 'Kompletacja zamówień'), true);
});

test('права й допуски з даних користувача враховуються, а без даних — відсутні', () => {
  const ad = 'Wymagane prawo jazdy, kod 95 i ADR. Praca zmianowa.';
  const none = scanAts(ad, cv());
  for (const n of ['Prawo jazdy', 'Kod 95', 'ADR']) assert.ok(none.missing.some((k) => k.display === n), n);
  const base = blankCv().data;
  const data = {
    ...base,
    basics: { ...base.basics, license: 'B, C' },
    extras: { driver: { categories: ['C'], code95: true, tachograph: false, adr: true, udt: false, fleet: '', routes: [] as ('PL' | 'UE')[] } },
  };
  // блок «Kierowca» друкується лише в шаблоні driver, тому лише там extras враховуються
  const have = scanAts(ad, data, { tpl: 'driver' });
  for (const n of ['Prawo jazdy', 'Kod 95', 'ADR']) assert.ok(have.matched.some((k) => k.display === n), n);
  const other = scanAts(ad, data, { tpl: 'classic' });
  assert.ok(other.matched.some((k) => k.display === 'Prawo jazdy'), 'поле prawo jazdy друкується в усіх шаблонах');
  for (const n of ['Kod 95', 'ADR']) assert.ok(other.missing.some((k) => k.display === n), n + ' не друкується в classic');
});

test('вимоги не додаються в навички автоматично (addTo відсутнє)', () => {
  const r = scanAts('Prawo jazdy kat. B, ADR, język angielski', cv());
  assert.ok(r.missing.length >= 3);
  for (const k of r.missing) assert.equal(k.addTo, undefined, k.display);
});

test('додавання відсутнього слова в навички: дублікатів немає', () => {
  const r = scanAts('Docker i Kubernetes', cv({ skillsHard: 'Git' }));
  let skills = 'Git';
  for (const k of r.missing) skills = insertText('skills', skills, k.display);
  skills = insertText('skills', skills, 'docker');
  assert.equal(skills, 'Git, Docker, Kubernetes');
});

test('низька оцінка дає підказку, велике оголошення не ламає сканер', () => {
  assert.ok(scanAts('Docker Kubernetes AWS Azure Linux', cv({ skillsHard: 'Git' })).hints.includes('low_score'));
  const huge = 'Docker '.repeat(50000);
  assert.doesNotThrow(() => scanAts(huge, cv()));
});

test('detectJobLang і tokenize: c++, c#, діакритика', () => {
  assert.deepEqual(tokenize('C++, C# i Łódź!'), ['c++', 'c#', 'i', 'lodz']);
  assert.equal(detectJobLang(tokenize('Wymagania oraz oferta dla nas')), 'pl');
  assert.equal(detectJobLang(tokenize('We offer the best tools for you and our team')), 'en');
  assert.equal(detectJobLang(tokenize('SQL Docker')), 'mixed');
});

test('cvSearchText збирає основні поля CV', () => {
  const txt = cvSearchText(cv({ summary: 'Alfa', skillsSoft: 'Beta', interests: 'Gamma' }));
  for (const w of ['Alfa', 'Beta', 'Gamma']) assert.ok(txt.includes(w), w);
});

import { MESSAGES } from '../src/domain/i18n/index.ts';

test('i18n: усі коди підказок перекладені, too_short і no_keywords називають польську й англійську', () => {
  const codes = ['too_short', 'no_keywords', 'mixed_lang', 'doc_lang_differs', 'low_score'] as const;
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const c of codes) {
      const text = (MESSAGES[lang] as Record<string, string>)[`ats_h_${c}`];
      assert.ok(text && text.length > 10, `${lang}/${c}`);
    }
    for (const c of ['too_short', 'no_keywords'] as const) {
      const text = (MESSAGES[lang] as Record<string, string>)[`ats_h_${c}`];
      const pl = /polsk|polish|польськ/i.test(text);
      const en = /angiel|english|англійськ/i.test(text);
      assert.ok(pl && en, `${lang}/${c}: немає згадки про польську й англійську`);
    }
  }
  assert.match(MESSAGES.uk.ats_req_note, /Перевірте, чи це у вас є, і додайте самостійно/);
  assert.match(MESSAGES.uk.ats_score_label, /Орієнтовна оцінка/);
});
