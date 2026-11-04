import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMPLATE_BLOCKS,
  extrasBlockFilled,
  extrasView,
  hasPrintedExtras,
  printedExtrasText,
  templateBlocks,
} from '../src/domain/extrasView.ts';
import { EXTRAS_DOC } from '../src/domain/docText.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { blankCv, duplicateCv, normalizeCv } from '../src/domain/cvOps.ts';
import { isBlank } from '../src/domain/completeness.ts';
import { cvSearchText, scanAts } from '../src/domain/atsScanner.ts';
import { parseBackup, serializeBackup } from '../src/domain/backup.ts';
import type { Cv, DocLang } from '../src/domain/types.ts';

/** CV з повністю заповненими extras і courses; шаблон і мову задає тест. */
function full(tpl: string, lang: DocLang = 'pl'): Cv {
  const cv = blankCv(lang);
  (cv as { tpl: string }).tpl = tpl;
  cv.data.extras = {
    driver: { categories: ['B', 'C', 'CE'], code95: true, tachograph: true, adr: true, udt: true, fleet: 'Ciągnik siodłowy,  naczepa', routes: ['UE', 'PL'] },
    tech: { sep: 'E do 1 kV', welding: ['MIG/MAG', 'TIG'], cnc: 'Fanuc, Siemens', drawings: true, bhp: true, certs: ['Operator suwnic', 'Pierwsza pomoc'] },
  };
  cv.data.courses = 'Kurs Excel\n• Projekt zaliczeniowy: sklep online\n- Kurs pierwszej pomocy';
  return cv;
}

test('шаблони без блоків (усі наявні) нічого не друкують, навіть із повними даними', () => {
  for (const tpl of TEMPLATES) {
    const v = extrasView(full(tpl));
    assert.deepEqual(v, { driver: null, tech: null, courses: null }, tpl);
    assert.equal(hasPrintedExtras(full(tpl)), false, tpl);
  }
  assert.deepEqual(templateBlocks('nieznany'), []);
});

test('карта шаблон → блоки: driver, trades і student по одному блоку', () => {
  assert.deepEqual(TEMPLATE_BLOCKS, { driver: ['driver'], trades: ['tech'], student: ['courses'] });
});

test('Kierowca (PL): рядки «підпис: значення», пункти через « · », маршрути в порядку PL, UE', () => {
  const T = EXTRAS_DOC.pl;
  const v = extrasView(full('driver'));
  assert.equal(v.tech, null);
  assert.equal(v.courses, null);
  assert.deepEqual(v.driver, {
    title: 'Uprawnienia i kwalifikacje',
    rows: [
      { label: T.licCategories, value: 'B · C · CE' },
      { label: T.permits, value: 'Kod 95 · Karta kierowcy (tachograf) · ADR · UDT' },
      { label: T.fleet, value: 'Ciągnik siodłowy, naczepa' },
      { label: T.routes, value: 'Polska · UE' },
    ],
  });
});

test('Kierowca (EN): ті самі рядки англійською', () => {
  const v = extrasView(full('driver', 'en'));
  assert.equal(v.driver?.title, 'Licences & qualifications');
  assert.deepEqual(v.driver?.rows.map((r) => r.value), ['B · C · CE', 'Code 95 (CPC) · Driver card (tachograph) · ADR · UDT', 'Ciągnik siodłowy, naczepa', 'Poland · EU']);
});

test('Kierowca: друкується лише позначене; порожні рядки й порожній блок не з’являються', () => {
  const cv = full('driver');
  cv.data.extras.driver = { categories: [' b ', 'B', '', 'C'], code95: false, tachograph: true, adr: false, udt: false, fleet: '   ', routes: [] };
  assert.deepEqual(extrasView(cv).driver?.rows, [
    { label: EXTRAS_DOC.pl.licCategories, value: 'b · C' },
    { label: EXTRAS_DOC.pl.permits, value: 'Karta kierowcy (tachograf)' },
  ]);
  cv.data.extras.driver = { categories: [], code95: false, tachograph: false, adr: false, udt: false, fleet: '', routes: [] };
  assert.equal(extrasView(cv).driver, null);
  assert.equal(extrasBlockFilled(cv, 'driver'), false);
  delete cv.data.extras.driver;
  assert.equal(extrasView(cv).driver, null);
});

test('Fachowiec (PL і EN): SEP, спосіб зварювання, CNC, додатково, сертифікати', () => {
  const pl = extrasView(full('trades')).tech;
  assert.equal(pl?.title, 'Uprawnienia i certyfikaty');
  assert.deepEqual(pl?.rows, [
    { label: 'Uprawnienia SEP', value: 'E do 1 kV' },
    { label: 'Spawanie', value: 'MIG/MAG · TIG' },
    { label: 'CNC', value: 'Fanuc, Siemens' },
    { label: 'Dodatkowo', value: 'Czytanie rysunku technicznego · BHP' },
    { label: 'Certyfikaty', value: 'Operator suwnic · Pierwsza pomoc' },
  ]);
  const en = extrasView(full('trades', 'en')).tech;
  assert.equal(en?.title, 'Qualifications & certificates');
  assert.deepEqual(en?.rows.map((r) => r.label), ['SEP qualifications', 'Welding', 'CNC', 'Also', 'Certificates']);
  assert.equal(en?.rows[3].value, 'Reading technical drawings · Health & safety (BHP)');
  // шаблон trades не показує блок водія й курси
  assert.equal(extrasView(full('trades')).driver, null);
  assert.equal(extrasView(full('trades')).courses, null);
});

test('Student: «Kursy i projekty», пункти без маркерів списку; блоків водія й майстра немає', () => {
  const v = extrasView(full('student'));
  assert.deepEqual(v.courses, { title: 'Kursy i projekty', lines: ['Kurs Excel', 'Projekt zaliczeniowy: sklep online', 'Kurs pierwszej pomocy'] });
  assert.equal(v.driver, null);
  assert.equal(v.tech, null);
  assert.equal(extrasView(full('student', 'en')).courses?.title, 'Courses & projects');
  const empty = full('student');
  empty.data.courses = ' \n ';
  assert.equal(extrasView(empty).courses, null);
});

test('заголовки блоків у документі: точні тексти, «Dane kierowcy» у документі не використовується', () => {
  assert.equal(EXTRAS_DOC.pl.driverTitle, 'Uprawnienia i kwalifikacje');
  assert.equal(EXTRAS_DOC.en.driverTitle, 'Licences & qualifications');
  assert.equal(EXTRAS_DOC.pl.coursesTitle, 'Kursy i projekty');
  assert.equal(EXTRAS_DOC.en.coursesTitle, 'Courses & projects');
  for (const lang of ['pl', 'en'] as const) {
    for (const [k, v] of Object.entries(EXTRAS_DOC[lang])) {
      assert.ok(v.trim().length > 0, `${lang}/${k}`);
      assert.ok(!/Dane kierowcy/i.test(v), `${lang}/${k}`);
    }
  }
  assert.deepEqual(Object.keys(EXTRAS_DOC.pl).sort(), Object.keys(EXTRAS_DOC.en).sort());
});

test('дані не втрачаються при зміні шаблону: блок зникає й повертається, самі дані ті самі', () => {
  const cv = full('classic');
  const snapshot = JSON.stringify(cv.data);
  for (const tpl of ['student', 'driver', 'trades', 'nordic', 'classic', 'driver']) {
    (cv as { tpl: string }).tpl = tpl;
    extrasView(cv);
    printedExtrasText(cv);
    assert.equal(JSON.stringify(cv.data), snapshot, `після ${tpl}`);
  }
  // той самий CV через normalizeCv, дублювання і бекап зберігає все, і блоки повертаються після зміни шаблону
  const norm = normalizeCv(JSON.parse(JSON.stringify(cv)));
  assert.equal(JSON.stringify(norm?.data), snapshot);
  // дублювання дає нові id записам досвіду й освіти, але курси й extras копіюються без змін
  const dup = duplicateCv(cv, 'kopia').data;
  assert.equal(dup.courses, cv.data.courses);
  assert.deepEqual(dup.extras, cv.data.extras);
  const back = parseBackup(serializeBackup([cv]));
  assert.ok(back.ok);
  assert.equal(JSON.stringify(back.cvs[0].data), snapshot);
  (back.cvs[0] as { tpl: string }).tpl = 'student';
  assert.equal(extrasView(back.cvs[0]).courses?.lines.length, 3);
});

test('courses у шаблонах, що їх не показують: не друкуються, не рахуються ATS, isBlank, але лежать у даних', () => {
  for (const tpl of ['classic', 'driver', 'trades', 'nordic']) {
    const cv = blankCv();
    (cv as { tpl: string }).tpl = tpl;
    cv.data.courses = 'Kurs obsługi wózka widłowego';
    assert.equal(extrasView(cv).courses, null, tpl);
    assert.equal(isBlank(cv), true, `${tpl}: isBlank`);
    assert.doesNotMatch(printedExtrasText(cv), /wózka/, tpl);
    const ats = scanAts('Wymagany wózek widłowy i kompletacja.', cv.data, { tpl });
    assert.equal(ats.matched.length, 0, `${tpl}: ATS не бачить курси`);
    assert.equal(cv.data.courses, 'Kurs obsługi wózka widłowego', `${tpl}: дані на місці`);
  }
  const student = blankCv();
  (student as { tpl: string }).tpl = 'student';
  student.data.courses = 'Kurs obsługi wózka widłowego';
  assert.equal(isBlank(student), false);
  assert.match(printedExtrasText(student), /wózka widłowego/);
  assert.equal(scanAts('Wymagany wózek widłowy.', student.data, { tpl: 'student' }).matched.length, 1);
});

test('extras (водій, майстер) так само рахуються лише для свого шаблону: isBlank і ATS', () => {
  const ad = 'Wymagane: kod 95, ADR, uprawnienia SEP, spawanie TIG.';
  const driver = full('driver');
  const trades = full('trades');
  const names = (cv: Cv) => scanAts(ad, cv.data, { tpl: (cv as { tpl: string }).tpl, docLang: cv.lang }).matched.map((k) => k.display);
  assert.deepEqual(names(driver).sort(), ['ADR', 'Kod 95']);
  assert.deepEqual(names(trades).sort(), ['Spawanie', 'TIG', 'Uprawnienia SEP']);
  assert.deepEqual(names(full('classic')), []);
  const only = blankCv();
  only.data.extras = { driver: { categories: ['C'], code95: false, tachograph: false, adr: false, udt: false, fleet: '', routes: [] } };
  (only as { tpl: string }).tpl = 'classic';
  assert.equal(isBlank(only), true);
  (only as { tpl: string }).tpl = 'driver';
  assert.equal(isBlank(only), false);
});

test('cvSearchText не додає несправжні слова: лише переданий друкований текст', () => {
  const cv = full('classic');
  assert.doesNotMatch(cvSearchText(cv.data), /kod 95|adr|tachograf|spawanie/i);
  assert.match(cvSearchText(cv.data, 'Kod 95: tak'), /Kod 95/);
});

test('повнота (extrasBlockFilled) і printedExtrasText збігаються з тим, що друкується', () => {
  const cv = full('driver');
  assert.equal(extrasBlockFilled(cv, 'driver'), true);
  assert.equal(extrasBlockFilled(cv, 'tech'), false);
  assert.equal(extrasBlockFilled(cv, 'courses'), false);
  const text = printedExtrasText(cv);
  assert.match(text, /Kategorie prawa jazdy: B · C · CE/);
  assert.match(text, /Dokumenty zawodowe: Kod 95 · Karta kierowcy \(tachograf\) · ADR · UDT/);
  assert.doesNotMatch(text, /Spawanie|Kurs Excel/);
});
