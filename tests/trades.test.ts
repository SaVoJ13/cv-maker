import test from 'node:test';
import assert from 'node:assert/strict';
import { EXTRAS_MAX_ITEMS, EXTRAS_MAX_VALUE, WELDING_METHODS, certsFromText, emptyTech, normalizeExtras, toggleWelding } from '../src/domain/extras.ts';
import { blankCv, normalizeCv, duplicateCv } from '../src/domain/cvOps.ts';
import { extrasView, hasPrintedExtras } from '../src/domain/extrasView.ts';
import { isBlank, sectionFilled, sectionIds } from '../src/domain/completeness.ts';
import { TEMPLATES, TEMPLATE_META, FREE_TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { parseBackup, serializeBackup } from '../src/domain/backup.ts';
import { ACCENTS } from '../src/domain/constants.ts';
import { contrastRatio, tint } from '../src/domain/color.ts';
import type { Cv, DocLang } from '../src/domain/types.ts';

function tradesCv(lang: DocLang = 'pl'): Cv {
  const cv = blankCv(lang);
  (cv as { tpl: string }).tpl = 'trades';
  cv.data.basics.name = 'Piotr Wiśniewski';
  cv.data.extras.tech = { sep: 'E do 1 kV', welding: ['MIG', 'TIG'], cnc: 'Fanuc, Siemens', drawings: true, bhp: true, certs: ['Operator suwnic', 'Pierwsza pomoc'] };
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

test('шаблон Fachowiec: у галереї, фото, ATS середній, PRO, галузь construction, безкоштовні без змін', () => {
  assert.ok(TEMPLATES.includes('trades'));
  assert.deepEqual(TEMPLATE_META.trades, { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'construction' });
  assert.deepEqual([...FREE_TEMPLATES].sort(), ['ats', 'classic', 'industrial', 'minimal']);
});

test('назви й описи шаблону Fachowiec є в усіх трьох мовах', () => {
  assert.equal(MESSAGES.pl.tpl_trades, 'Fachowiec');
  assert.equal(MESSAGES.uk.tpl_trades, 'Майстер');
  assert.equal(MESSAGES.pl.s_trades, 'Uprawnienia i certyfikaty');
  assert.equal(MESSAGES.en.s_trades, 'Qualifications & certificates');
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const k of ['tpl_trades', 'tpl_desc_trades', 'tpl_for_trades', 'tpl_pro_trades', 'tpl_con_trades', 's_trades', 'h_trades', 'f_tr_sep', 'f_tr_sep_ph', 'f_tr_weld', 'f_tr_cnc', 'f_tr_cnc_ph', 'f_tr_more', 'f_tr_drawings', 'f_tr_bhp', 'f_tr_certs', 'f_tr_certs_hint', 'f_tr_limit']) {
      assert.ok((MESSAGES[lang] as Record<string, string>)[k].trim().length > 0, `${lang}.${k}`);
    }
  }
  for (const [k, v] of Object.entries(MESSAGES.uk)) if (/trades|_tr_/.test(k)) assert.ok(!/[ыэъё]/i.test(v), k);
});

test('секція «Uprawnienia i certyfikaty» є в редакторі лише для Fachowiec, не для Kierowca й інших', () => {
  const cv = blankCv();
  for (const tpl of TEMPLATES) {
    (cv as { tpl: string }).tpl = tpl;
    assert.equal(sectionIds(cv).includes('tech'), tpl === 'trades', tpl);
    assert.equal(sectionIds(cv).includes('driver'), tpl === 'driver', tpl);
  }
  (cv as { tpl: string }).tpl = 'trades';
  assert.deepEqual(sectionIds(cv).slice(0, 6), ['basics', 'photo', 'extra', 'qr', 'tech', 'summary']);
  assert.equal(sectionFilled(cv, 'tech'), false);
  cv.data.extras.tech = { ...emptyTech(), welding: ['TIG'] };
  assert.equal(sectionFilled(cv, 'tech'), true);
  (cv as { tpl: string }).tpl = 'classic';
  assert.deepEqual(sectionIds(cv), ['basics', 'photo', 'extra', 'qr', 'summary', 'exp', 'edu', 'skills', 'lang', 'interests', 'rodo']);
});

test('toggleWelding: порядок MIG, MAG, TIG, MMA; повтор знімає; незнайомі в кінці; не більше 8', () => {
  let w: string[] = [];
  for (const m of ['TIG', 'MIG', 'MMA']) w = toggleWelding(w, m);
  assert.deepEqual(w, ['MIG', 'TIG', 'MMA']);
  assert.deepEqual(toggleWelding(w, 'TIG'), ['MIG', 'MMA']);
  assert.deepEqual(toggleWelding(['MIG/MAG'], 'TIG'), ['TIG', 'MIG/MAG']);
  assert.deepEqual([...WELDING_METHODS], ['MIG', 'MAG', 'TIG', 'MMA']);
});

test('certsFromText: по рядку на запис, до 8 записів по 80 символів, Enter у кінці не губиться', () => {
  assert.deepEqual(certsFromText('a\nb'), ['a', 'b']);
  assert.deepEqual(certsFromText('a\r\nb\n'), ['a', 'b', '']);
  const many = certsFromText(Array.from({ length: 20 }, (_, i) => `c${i}`).join('\n'));
  assert.equal(many.length, EXTRAS_MAX_ITEMS);
  assert.equal(certsFromText('q'.repeat(300))[0].length, EXTRAS_MAX_VALUE);
});

test('Fachowiec (PL): заголовок і рядки «підпис: значення», нічого не підставляється', () => {
  const v = extrasView(tradesCv()).tech;
  assert.equal(v?.title, 'Uprawnienia i certyfikaty');
  assert.deepEqual(v?.rows, [
    { label: 'Uprawnienia SEP', value: 'E do 1 kV' },
    { label: 'Spawanie', value: 'MIG · TIG' },
    { label: 'CNC', value: 'Fanuc, Siemens' },
    { label: 'Dodatkowo', value: 'Czytanie rysunku technicznego · BHP' },
    { label: 'Certyfikaty', value: 'Operator suwnic · Pierwsza pomoc' },
  ]);
  // тільки позначене: без CNC, без BHP — відповідних рядків/пунктів немає
  const cv = tradesCv();
  cv.data.extras.tech = { ...emptyTech(), drawings: true };
  assert.deepEqual(extrasView(cv).tech?.rows, [{ label: 'Dodatkowo', value: 'Czytanie rysunku technicznego' }]);
  assert.equal(extrasView(tradesCv()).driver, null);
});

test('порожній блок Fachowiec нічого не друкує: ні в прев’ю-даних, ні в PDF, і CV вважається порожнім', () => {
  const cv = tradesCv();
  cv.data.basics.name = '';
  cv.data.extras.tech = emptyTech();
  assert.equal(extrasView(cv).tech, null);
  assert.equal(hasPrintedExtras(cv), false);
  assert.equal(isBlank(cv), true);
  assert.doesNotMatch(pdfText(cv), /Uprawnienia i certyfikaty/);
  // білі пробіли теж порожні
  cv.data.extras.tech = { ...emptyTech(), sep: '   ', certs: [' ', ''] };
  assert.equal(extrasView(cv).tech, null);
  delete cv.data.extras.tech;
  assert.equal(extrasView(cv).tech, null);
});

test('PDF Fachowiec: ті самі підписи й значення, що й у прев’ю (PL і EN)', () => {
  const pl = pdfText(tradesCv());
  assert.match(pl, /UPRAWNIENIA I CERTYFIKATY/);
  for (const r of extrasView(tradesCv()).tech!.rows) {
    assert.ok(pl.includes(`${r.label}: `), r.label);
    assert.ok(pl.includes(r.value), r.value);
  }
  const en = pdfText(tradesCv('en'));
  assert.match(en, /QUALIFICATIONS & CERTIFICATES/);
  assert.match(en, /SEP qualifications: /);
  assert.match(en, /Reading technical drawings · Health & safety \(BHP\)/);
  assert.match(en, /Certificates: /);
});

test('PDF: у інших шаблонах блок майстра не друкується, навіть із даними', () => {
  for (const tpl of ['classic', 'driver', 'industrial']) {
    const cv = tradesCv();
    (cv as { tpl: string }).tpl = tpl;
    assert.doesNotMatch(pdfText(cv), /Uprawnienia SEP|Spawanie|Certyfikaty/, tpl);
  }
});

test('довгі значення: ліміт 80 символів на поле і 8 записів у списках (normalizeExtras, normalizeCv)', () => {
  const long = 'W'.repeat(500);
  const ex = normalizeExtras({ tech: { sep: long, welding: Array.from({ length: 12 }, () => long), cnc: long, drawings: true, bhp: true, certs: Array.from({ length: 12 }, () => long) } });
  assert.equal(ex.tech?.sep.length, EXTRAS_MAX_VALUE);
  assert.equal(ex.tech?.cnc.length, EXTRAS_MAX_VALUE);
  assert.equal(ex.tech?.welding.length, EXTRAS_MAX_ITEMS);
  assert.equal(ex.tech?.certs.length, EXTRAS_MAX_ITEMS);
  assert.ok(ex.tech?.certs.every((c) => c.length === EXTRAS_MAX_VALUE));
  const raw = JSON.parse(JSON.stringify(tradesCv())) as Record<string, any>;
  raw.data.extras.tech.sep = long;
  assert.equal(normalizeCv(raw)?.data.extras.tech?.sep.length, EXTRAS_MAX_VALUE);
});

test('довгі значення без пробілів: блок і PDF лишаються цілими, рядків не більше п’яти', () => {
  const cv = tradesCv();
  const w = 'Z'.repeat(EXTRAS_MAX_VALUE);
  cv.data.extras.tech = normalizeExtras({ tech: { sep: w, welding: ['MIG', 'MAG', 'TIG', 'MMA'], cnc: w, drawings: true, bhp: true, certs: Array.from({ length: 10 }, (_, i) => w.slice(0, -1) + i) } }).tech;
  const v = extrasView(cv).tech!;
  assert.equal(v.rows.length, 5);
  assert.equal(v.rows[0].value.length, EXTRAS_MAX_VALUE);
  assert.equal(v.rows[4].value.split(' · ').length, EXTRAS_MAX_ITEMS);
  const doc = buildPdfDocument(cv);
  assert.ok(Array.isArray(doc.content) && doc.content.length > 5);
  assert.match(pdfText(cv), new RegExp('Z{' + EXTRAS_MAX_VALUE + '}'));
});

test('зміна шаблону не губить дані: Fachowiec ↔ інші, нормалізація, дублювання, бекап', () => {
  const cv = tradesCv();
  cv.data.extras.driver = { categories: ['B'], code95: true, tachograph: false, adr: false, udt: false, fleet: '', routes: [] };
  const snapshot = JSON.stringify(cv.data);
  for (const tpl of ['driver', 'classic', 'trades', 'nordic', 'trades']) {
    (cv as { tpl: string }).tpl = tpl;
    extrasView(cv);
    pdfText(cv);
    assert.equal(JSON.stringify(cv.data), snapshot, tpl);
  }
  assert.equal(extrasView(cv).driver, null);
  (cv as { tpl: string }).tpl = 'driver';
  assert.equal(extrasView(cv).tech, null);
  assert.ok(extrasView(cv).driver);
  // порядок ключів у extras після нормалізації може бути іншим, тож порівнюємо за значенням
  assert.deepEqual(normalizeCv(JSON.parse(JSON.stringify(cv)))?.data, JSON.parse(snapshot));
  assert.deepEqual(duplicateCv(cv, 'kopia').data.extras, cv.data.extras);
  const back = parseBackup(serializeBackup([cv]));
  assert.ok(back.ok);
  assert.deepEqual(back.cvs[0].data, JSON.parse(snapshot));
});

test('Fachowiec: текст у кольорі акценту читається на тонованій шапці й на білому (контраст ≥ 4.5:1, усі 12 кольорів)', () => {
  assert.equal(Object.keys(ACCENTS).length, 12);
  for (const [id, ac] of Object.entries(ACCENTS)) {
    assert.ok(contrastRatio(ac, tint(ac)) >= 4.5, `${id} на шапці: ${contrastRatio(ac, tint(ac)).toFixed(2)}`);
    assert.ok(contrastRatio(ac, '#FFFFFF') >= 4.5, `${id} на білому`);
  }
});

test('EN-підпис «Other skills» у документі й у редакторі; PL і UA без змін', () => {
  assert.equal(extrasView(tradesCv('en')).tech?.rows[3].label, 'Other skills');
  assert.equal(MESSAGES.en.f_tr_more, 'Other skills');
  assert.equal(MESSAGES.pl.f_tr_more, 'Dodatkowo');
  assert.equal(MESSAGES.uk.f_tr_more, 'Додатково');
  assert.equal(extrasView(tradesCv()).tech?.rows[3].label, 'Dodatkowo');
});

test('uk.ts: у рядках «Водія» і «Майстра» той самий апостроф (U+02BC), що й у решті словника', () => {
  for (const k of ['tpl_desc_driver', 'tpl_desc_trades']) {
    const v = (MESSAGES.uk as Record<string, string>)[k];
    assert.ok(v.includes('ʼ'), k);
    assert.ok(!v.includes('’') && !v.includes("'"), k);
  }
});

test('uk.ts: у всьому словнику лише апостроф U+02BC: жодного ’ (U+2019) і жодного прямого \'', () => {
  for (const [k, v] of Object.entries(MESSAGES.uk)) {
    assert.ok(!v.includes('\u2019'), `${k}: ’`);
    assert.ok(!v.includes("'"), `${k}: прямий '`);
  }
});
