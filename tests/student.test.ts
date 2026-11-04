import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTRAS_MAX_ITEMS, EXTRAS_MAX_VALUE, clampLines } from '../src/domain/extras.ts';
import { blankCv, duplicateCv, normalizeCv, sampleCv } from '../src/domain/cvOps.ts';
import { extrasView, hasPrintedExtras } from '../src/domain/extrasView.ts';
import { isBlank, sectionFilled, sectionIds } from '../src/domain/completeness.ts';
import { TEMPLATES, TEMPLATE_META, FREE_TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { parseBackup, serializeBackup } from '../src/domain/backup.ts';
import { ACCENTS } from '../src/domain/constants.ts';
import { contrastRatio, tint } from '../src/domain/color.ts';
import type { Cv, DocLang } from '../src/domain/types.ts';

function studentCv(lang: DocLang = 'pl'): Cv {
  const cv = blankCv(lang);
  (cv as { tpl: string }).tpl = 'student';
  cv.data.basics.name = 'Anna Nowak';
  cv.data.education = [{ id: 'ed1', school: 'Politechnika Łódzka', degree: 'Licencjat', field: 'Informatyka', from: '2021', to: '' }];
  cv.data.experience = [{ id: 'ex1', role: 'Stażysta', company: 'Firma X', city: 'Łódź', from: '07.2024', to: '09.2024', current: false, bullets: 'Testowanie aplikacji' }];
  cv.data.courses = 'Kurs Excel\nProjekt zaliczeniowy: sklep online';
  return cv;
}

function pdfText(cv: Cv): string {
  const out: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') out.push(n);
    else if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') Object.values(n as Record<string, unknown>).forEach(walk);
  };
  walk(buildPdfDocument(cv).content);
  return out.join('\n');
}

test('шаблон Student: у галереї, фото, ATS середній, PRO, галузь students, безкоштовні без змін', () => {
  assert.ok(TEMPLATES.includes('student'));
  assert.deepEqual(TEMPLATE_META.student, { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'students' });
  assert.deepEqual([...FREE_TEMPLATES].sort(), ['ats', 'classic', 'industrial', 'minimal']);
});

test('назви й тексти Student є в усіх трьох мовах; жодного російського знака в UA', () => {
  assert.equal(MESSAGES.pl.tpl_student, 'Student');
  assert.equal(MESSAGES.uk.tpl_student, 'Студент');
  assert.equal(MESSAGES.pl.s_student, 'Kursy i projekty');
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const k of ['tpl_student', 'tpl_desc_student', 'tpl_for_student', 'tpl_pro_student', 'tpl_con_student', 's_student', 'h_student', 'f_st_hint']) {
      assert.ok((MESSAGES[lang] as Record<string, string>)[k].trim().length > 0, `${lang}.${k}`);
    }
  }
  for (const [k, v] of Object.entries(MESSAGES.uk)) if (/student|_st_/.test(k)) assert.ok(!/[ыэъё]/i.test(v), k);
});

test('секція «Kursy i projekty» є в редакторі лише для Student', () => {
  const cv = blankCv();
  for (const tpl of TEMPLATES) {
    (cv as { tpl: string }).tpl = tpl;
    assert.equal(sectionIds(cv).includes('courses'), tpl === 'student', tpl);
  }
  (cv as { tpl: string }).tpl = 'student';
  assert.equal(sectionFilled(cv, 'courses'), false);
  cv.data.courses = 'Kurs Excel';
  assert.equal(sectionFilled(cv, 'courses'), true);
  (cv as { tpl: string }).tpl = 'classic';
  assert.deepEqual(sectionIds(cv), ['basics', 'photo', 'extra', 'summary', 'exp', 'edu', 'skills', 'lang', 'interests', 'rodo']);
});

test('clampLines і normalizeCv: до 8 рядків по 80 символів, Enter у кінці не губиться, короткий текст не змінюється', () => {
  assert.equal(clampLines('a\nb'), 'a\nb');
  assert.equal(clampLines('a\r\nb\n'), 'a\nb\n');
  assert.equal(clampLines(Array.from({ length: 20 }, (_, i) => `c${i}`).join('\n')).split('\n').length, EXTRAS_MAX_ITEMS);
  assert.equal(clampLines('q'.repeat(300)).length, EXTRAS_MAX_VALUE);
  const raw = JSON.parse(JSON.stringify(studentCv())) as Record<string, any>;
  raw.data.courses = Array.from({ length: 12 }, () => 'W'.repeat(200)).join('\n');
  const lines = normalizeCv(raw)!.data.courses.split('\n');
  assert.equal(lines.length, EXTRAS_MAX_ITEMS);
  assert.ok(lines.every((l) => l.length === EXTRAS_MAX_VALUE));
});

test('Student: блок «Kursy i projekty» (PL) і «Courses & projects» (EN); нічого не підставляється', () => {
  assert.deepEqual(extrasView(studentCv()).courses, { title: 'Kursy i projekty', lines: ['Kurs Excel', 'Projekt zaliczeniowy: sklep online'] });
  assert.equal(extrasView(studentCv('en')).courses?.title, 'Courses & projects');
  const empty = studentCv();
  empty.data.courses = ' \n  \n';
  assert.equal(extrasView(empty).courses, null);
  assert.equal(extrasView(blankCv()).courses, null);
});

test('порожній блок Student нічого не друкує, CV без даних вважається порожнім', () => {
  const cv = blankCv();
  (cv as { tpl: string }).tpl = 'student';
  cv.data.courses = '';
  assert.equal(hasPrintedExtras(cv), false);
  assert.equal(isBlank(cv), true);
  assert.doesNotMatch(pdfText(cv), /KURSY I PROJEKTY/);
  cv.data.courses = 'Kurs Excel';
  assert.equal(isBlank(cv), false);
});

test('PDF Student: освіта → курси й проєкти → досвід (PL і EN)', () => {
  const pl = pdfText(studentCv());
  const iEdu = pl.indexOf('WYKSZTAŁCENIE');
  const iCou = pl.indexOf('KURSY I PROJEKTY');
  const iExp = pl.indexOf('DOŚWIADCZENIE ZAWODOWE');
  assert.ok(iEdu >= 0 && iCou > iEdu && iExp > iCou, `${iEdu} ${iCou} ${iExp}`);
  assert.match(pl, /Projekt zaliczeniowy: sklep online/);
  const en = pdfText(studentCv('en'));
  assert.ok(en.indexOf('EDUCATION') < en.indexOf('COURSES & PROJECTS') && en.indexOf('COURSES & PROJECTS') < en.indexOf('WORK EXPERIENCE'));
});

test('в інших шаблонах досвід іде перед освітою, а курси не друкуються', () => {
  for (const tpl of ['classic', 'driver', 'trades']) {
    const cv = studentCv();
    (cv as { tpl: string }).tpl = tpl;
    const t = pdfText(cv).toUpperCase();
    assert.ok(t.indexOf('DOŚWIADCZENIE ZAWODOWE') < t.indexOf('WYKSZTAŁCENIE'), tpl);
    assert.doesNotMatch(t, /KURSY I PROJEKTY|SKLEP ONLINE/, tpl);
  }
});

test('довгі значення без пробілів: 8 рядків по 80 символів, PDF лишається цілим', () => {
  const cv = studentCv();
  cv.data.courses = clampLines(Array.from({ length: 12 }, (_, i) => 'Z'.repeat(79) + i).join('\n'));
  assert.equal(extrasView(cv).courses?.lines.length, EXTRAS_MAX_ITEMS);
  assert.ok(extrasView(cv).courses?.lines.every((l) => l.length === EXTRAS_MAX_VALUE));
  const doc = buildPdfDocument(cv);
  assert.ok(Array.isArray(doc.content) && doc.content.length > 5);
  assert.match(pdfText(cv), new RegExp('Z{79}0'));
});

test('демо-дані sampleCv друкуються лише в шаблоні Student', () => {
  const s = sampleCv();
  for (const tpl of TEMPLATES) {
    (s as { tpl: string }).tpl = tpl;
    assert.equal(extrasView(s).courses !== null, tpl === 'student', tpl);
  }
});

test('зміна шаблону не губить courses: Student ↔ інші, нормалізація, дублювання, бекап', () => {
  const cv = studentCv();
  const snapshot = JSON.parse(JSON.stringify(cv.data));
  for (const tpl of ['classic', 'driver', 'trades', 'student']) {
    (cv as { tpl: string }).tpl = tpl;
    extrasView(cv);
    pdfText(cv);
    assert.deepEqual(cv.data, snapshot, tpl);
  }
  assert.deepEqual(normalizeCv(JSON.parse(JSON.stringify(cv)))?.data, snapshot);
  assert.equal(duplicateCv(cv, 'kopia').data.courses, cv.data.courses);
  const back = parseBackup(serializeBackup([cv]));
  assert.ok(back.ok);
  assert.deepEqual(back.cvs[0].data, snapshot);
});

test('Student: текст акценту читається на тонованих заголовках і шапці для всіх 12 кольорів (≥ 4.5:1)', () => {
  assert.equal(Object.keys(ACCENTS).length, 12);
  for (const [id, ac] of Object.entries(ACCENTS)) {
    assert.ok(contrastRatio(ac, tint(ac)) >= 4.5, `${id}: ${contrastRatio(ac, tint(ac)).toFixed(2)}`);
    assert.ok(contrastRatio(ac, '#FFFFFF') >= 4.5, `${id} на білому`);
  }
});
