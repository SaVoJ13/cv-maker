import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTRAS_MAX_ITEMS, EXTRAS_MAX_VALUE, LICENCE_CATEGORIES, clampValue, emptyDriver, normalizeExtras, toggleCategory } from '../src/domain/extras.ts';
import { blankCv, normalizeCv } from '../src/domain/cvOps.ts';
import { extrasView } from '../src/domain/extrasView.ts';
import { sectionFilled, sectionIds } from '../src/domain/completeness.ts';
import { TEMPLATES, TEMPLATE_META } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import type { Cv, DocLang } from '../src/domain/types.ts';

function driverCv(lang: DocLang = 'pl'): Cv {
  const cv = blankCv(lang);
  (cv as { tpl: string }).tpl = 'driver';
  cv.data.basics.name = 'Jan Nowak';
  cv.data.extras.driver = { categories: ['B', 'C', 'CE'], code95: true, tachograph: true, adr: false, udt: false, fleet: 'Ciągnik siodłowy z naczepą', routes: ['PL', 'UE'] };
  return cv;
}

/** Увесь текст PDF-документа (підписи, значення, заголовки) в одному рядку. */
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

test('шаблон Kierowca: у галереї, зі світлим фото, ATS середній, PRO, галузь drivers, одна колонка', () => {
  assert.ok(TEMPLATES.includes('driver'));
  assert.deepEqual(TEMPLATE_META.driver, { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'drivers' });
});

test('назви й описи шаблону Kierowca є в усіх трьох мовах і згадують додаткові поля', () => {
  assert.equal(MESSAGES.pl.tpl_driver, 'Kierowca');
  assert.equal(MESSAGES.uk.tpl_driver, 'Водій');
  assert.equal(MESSAGES.en.tpl_driver, 'Driver');
  assert.match(MESSAGES.pl.tpl_desc_driver, /Dane kierowcy/);
  assert.match(MESSAGES.uk.tpl_desc_driver, /Дані водія/);
  assert.match(MESSAGES.en.tpl_desc_driver, /Driver details/);
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const k of ['tpl_driver', 'tpl_desc_driver', 'tpl_for_driver', 'tpl_pro_driver', 'tpl_con_driver', 's_driver', 'h_driver']) {
      assert.ok((MESSAGES[lang] as Record<string, string>)[k].trim().length > 0, `${lang}.${k}`);
    }
  }
  // усі UA-тексти до водія звертаються без російських літер
  for (const [k, v] of Object.entries(MESSAGES.uk)) if (/driver|dr_/.test(k)) assert.ok(!/[ыэъё]/i.test(v), k);
});

test('секція «Dane kierowcy» є в редакторі лише для шаблону Kierowca', () => {
  const cv = blankCv();
  for (const tpl of TEMPLATES) {
    (cv as { tpl: string }).tpl = tpl;
    assert.equal(sectionIds(cv).includes('driver'), tpl === 'driver', tpl);
  }
  // порядок інших секцій не змінюється
  (cv as { tpl: string }).tpl = 'classic';
  assert.deepEqual(sectionIds(cv), ['basics', 'photo', 'extra', 'summary', 'exp', 'edu', 'skills', 'lang', 'interests', 'rodo']);
  (cv as { tpl: string }).tpl = 'driver';
  assert.deepEqual(sectionIds(cv).slice(0, 5), ['basics', 'photo', 'extra', 'driver', 'summary']);
  // крапка «заповнено» залежить від того, що друкується
  assert.equal(sectionFilled(cv, 'driver'), false);
  cv.data.extras.driver = { ...emptyDriver(), categories: ['B'] };
  assert.equal(sectionFilled(cv, 'driver'), true);
});

test('ліміти: normalizeExtras обрізає довгі значення (80) і списки (8), не чіпає короткі', () => {
  const long = 'x'.repeat(500);
  const ex = normalizeExtras({
    driver: { categories: Array.from({ length: 20 }, (_, i) => `K${i}`), fleet: long, routes: ['PL', 'UE', 'PL', 'UE', 'PL'] },
    tech: { sep: long, cnc: long, welding: Array.from({ length: 12 }, () => long), certs: [long] },
  });
  assert.equal(ex.driver?.fleet.length, EXTRAS_MAX_VALUE);
  assert.equal(ex.driver?.categories.length, EXTRAS_MAX_ITEMS);
  assert.deepEqual(ex.driver?.routes, ['PL', 'UE']);
  assert.equal(ex.tech?.sep.length, EXTRAS_MAX_VALUE);
  assert.equal(ex.tech?.cnc.length, EXTRAS_MAX_VALUE);
  assert.equal(ex.tech?.welding.length, EXTRAS_MAX_ITEMS);
  assert.ok(ex.tech?.welding.every((w) => w.length === EXTRAS_MAX_VALUE));
  assert.equal(ex.tech?.certs[0].length, EXTRAS_MAX_VALUE);
  const short = normalizeExtras({ driver: { fleet: 'Ciągnik', categories: ['B'] } });
  assert.equal(short.driver?.fleet, 'Ciągnik');
  assert.deepEqual(short.driver?.categories, ['B']);
});

test('ліміти: normalizeCv застосовує їх до збереженого CV; посилання QR не обрізається', () => {
  const raw = JSON.parse(JSON.stringify(driverCv())) as Record<string, any>;
  raw.data.extras.driver.fleet = 'y'.repeat(300);
  raw.data.extras.qr = { enabled: true, url: 'https://example.com/' + 'a'.repeat(200), label: '' };
  const cv = normalizeCv(raw);
  assert.equal(cv?.data.extras.driver?.fleet.length, EXTRAS_MAX_VALUE);
  assert.equal(cv?.data.extras.qr?.url.length, 'https://example.com/'.length + 200);
});

test('clampValue не розриває емодзі (сурогатні пари)', () => {
  const s = '🚚'.repeat(100);
  const c = clampValue(s);
  assert.equal(Array.from(c).length, EXTRAS_MAX_VALUE);
  assert.ok(!/[\ud800-\udbff]$/.test(c));
  assert.equal(clampValue('krótki'), 'krótki');
});

test('toggleCategory: стандартний порядок, повтор знімає, незнайомі лишаються в кінці, не більше 8', () => {
  let c: string[] = [];
  for (const k of ['CE', 'B', 'C']) c = toggleCategory(c, k);
  assert.deepEqual(c, ['B', 'C', 'CE']);
  assert.deepEqual(toggleCategory(c, 'C'), ['B', 'CE']);
  assert.deepEqual(toggleCategory(['AM', 'B'], 'D'), ['B', 'D', 'AM']);
  assert.deepEqual(toggleCategory([...LICENCE_CATEGORIES], 'T').length, EXTRAS_MAX_ITEMS);
});

test('довгі значення: у блоці водія лишаються цілими (до ліміту) і не множать рядків', () => {
  const cv = driverCv();
  cv.data.extras = normalizeExtras({
    driver: { ...cv.data.extras.driver, fleet: 'Z'.repeat(400), categories: ['B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D', 'DE', 'T', 'AM'] },
  });
  const v = extrasView(cv).driver;
  assert.equal(v?.rows.length, 4);
  assert.equal(v?.rows[2].value.length, EXTRAS_MAX_VALUE);
  assert.equal(v?.rows[0].value, 'B · BE · C1 · C · C1E · CE · D · DE');
  assert.ok(v?.rows.every((r) => r.value.length <= EXTRAS_MAX_ITEMS * (EXTRAS_MAX_VALUE + 3)));
});

test('PDF Kierowca (PL): заголовок і рядки «підпис: значення» тими самими текстами, що й у прев’ю', () => {
  const text = pdfText(driverCv());
  assert.match(text, /Uprawnienia i kwalifikacje/i);
  for (const r of extrasView(driverCv()).driver!.rows) {
    assert.ok(text.includes(`${r.label}: `), r.label);
    assert.ok(text.includes(r.value), r.value);
  }
  assert.doesNotMatch(text, /Dane kierowcy/);
});

test('PDF Kierowca (EN): англійські підписи й заголовок', () => {
  const text = pdfText(driverCv('en'));
  assert.match(text, /Licences & qualifications/i);
  assert.match(text, /Licence categories: /);
  assert.match(text, /Code 95 \(CPC\)/);
  assert.match(text, /Poland · EU/);
});

test('PDF: порожній блок не друкується; в інших шаблонах блок водія не друкується навіть із даними', () => {
  const empty = driverCv();
  empty.data.extras.driver = emptyDriver();
  assert.doesNotMatch(pdfText(empty), /Uprawnienia i kwalifikacje/i);
  const classic = driverCv();
  (classic as { tpl: string }).tpl = 'classic';
  assert.doesNotMatch(pdfText(classic), /Kategorie prawa jazdy|Uprawnienia i kwalifikacje/);
});

test('PDF: довгі значення (80 символів без пробілів) не розривають структуру документа', () => {
  const cv = driverCv();
  cv.data.extras.driver!.fleet = 'W'.repeat(EXTRAS_MAX_VALUE);
  cv.data.extras.driver!.categories = ['B', 'BE', 'C1', 'C', 'C1E', 'CE', 'D', 'DE'];
  const doc = buildPdfDocument(cv);
  assert.ok(Array.isArray(doc.content) && doc.content.length > 5);
  assert.match(pdfText(cv), new RegExp('W{' + EXTRAS_MAX_VALUE + '}'));
});
