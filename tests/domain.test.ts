import test from 'node:test';
import assert from 'node:assert/strict';
import {
  blankCv,
  dateKey,
  dateRange,
  documentClause,
  duplicateCv,
  extraDetails,
  lines,
  list,
  mainHas,
  moveItem,
  normalizeCv,
  sampleCv,
  showsPhoto,
  sideBlocks,
  sidebarRows,
  sortExperience,
} from '../src/domain/cvOps.ts';
import { DOC, rodoText } from '../src/domain/docText.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { qualityChecks } from '../src/domain/quality.ts';
import { buildPdfDocument, pdfFileName } from '../src/domain/pdf.ts';
import { TEMPLATES, TEMPLATE_META } from '../src/domain/templates.ts';
import { PHOTO_DEFAULT, fitWithin, normalizePhotoView, panBy, previewBox, squareCrop, zoomAt } from '../src/domain/photo.ts';
import { loadState, saveState, STORAGE_KEY, type PersistedState } from '../src/store/persist.ts';
import { reducer } from '../src/store/reducer.ts';
import { pageCount } from '../src/domain/pages.ts';
import { bytesToBase64 } from '../src/export/base64.ts';
import { PdfStageError, errorText, isUnimplementedError } from '../src/export/errors.ts';
import { vfsFromScript } from '../src/export/vfs.ts';
import { mixHex, tint } from '../src/domain/color.ts';
import { BACKUP_APP, backupFileName, parseBackup, planImport, serializeBackup } from '../src/domain/backup.ts';
import { FREE_ACCESS, consumeCredit, decideExport, grantCredit, normalizeAccess } from '../src/domain/access.ts';
import { ACCESS_KEY, loadAccess, saveAccess } from '../src/store/accessPersist.ts';

test('lines i list czyszczą tekst', () => {
  assert.deepEqual(lines('• Jeden\n- Dwa\r\n\n  * Trzy  '), ['Jeden', 'Dwa', 'Trzy']);
  assert.deepEqual(list('React, TypeScript; Git\nJest,, '), ['React', 'TypeScript', 'Git', 'Jest']);
});

test('dateKey rozumie MM.RRRR i RRRR', () => {
  assert.ok(dateKey('03.2023') > dateKey('12.2022'));
  assert.ok(dateKey('2021') > 0);
  assert.equal(dateKey(''), 0);
  assert.equal(dateKey('brak'), 0);
});

test('dateRange używa „obecnie" i radzi sobie z brakami', () => {
  assert.equal(dateRange({ from: '03.2023', to: '', current: true }, DOC.pl), '03.2023 – obecnie');
  assert.equal(dateRange({ from: '03.2023', to: '', current: true }, DOC.en), '03.2023 – present');
  assert.equal(dateRange({ from: '', to: '' }, DOC.pl), '');
  assert.equal(dateRange({ from: '2017', to: '' }, DOC.pl), '2017');
});

test('sortExperience: trwające pierwsze, potem po dacie zakończenia, potem rozpoczęcia', () => {
  const mk = (role: string, from: string, to: string, current = false) => ({
    id: role, role, company: '', city: '', from, to, current, bullets: '',
  });
  const sorted = sortExperience([
    mk('stare', '01.2015', '12.2017'),
    mk('trwa', '03.2023', '', true),
    mk('srednie', '01.2018', '12.2020'),
    mk('srednie-krotsze', '06.2019', '12.2020'),
  ]);
  assert.deepEqual(sorted.map((e) => e.role), ['trwa', 'srednie-krotsze', 'srednie', 'stare']);
});

test('moveItem nie wychodzi poza granice', () => {
  const a = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.equal(moveItem(a, 'a', -1), a);
  assert.deepEqual(moveItem(a, 'a', 1).map((x) => x.id), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(a, 'c', -1).map((x) => x.id), ['a', 'c', 'b']);
});

test('klauzula RODO: wariant bieżący, przyszły, stanowisko i angielski', () => {
  const cur = rodoText({ lang: 'pl', rodo: 'current', rodoTarget: '' });
  assert.match(cur, /art\. 6 ust\. 1 lit\. a/);
  assert.match(cur, /2016\/679/);
  assert.match(cur, /aplikowane przeze mnie stanowisko/);
  assert.doesNotMatch(cur, /przyszłych/);
  const fut = rodoText({ lang: 'pl', rodo: 'future', rodoTarget: ' Senior Developer ' });
  assert.match(fut, /stanowisko Senior Developer/);
  assert.match(fut, /przyszłych rekrutacji/);
  const en = rodoText({ lang: 'en', rodo: 'future', rodoTarget: '' });
  assert.match(en, /Article 6\(1\)\(a\)/);
  assert.match(en, /future recruitment/);
});

test('interfejs: PL, UK i EN mają te same klucze i niepuste teksty', () => {
  const pl = Object.keys(MESSAGES.pl).sort();
  assert.deepEqual(Object.keys(MESSAGES.en).sort(), pl);
  assert.deepEqual(Object.keys(MESSAGES.uk).sort(), pl);
  for (const k of pl) {
    for (const lang of ['pl', 'uk', 'en'] as const) {
      assert.ok(MESSAGES[lang][k as keyof typeof MESSAGES.pl].trim().length > 0, `${lang}.${k}`);
    }
  }
});

test('словник uk: справді український текст, а не копія польського чи англійського', () => {
  const same = Object.keys(MESSAGES.pl).filter(
    (k) => MESSAGES.uk[k as keyof typeof MESSAGES.pl] === MESSAGES.pl[k as keyof typeof MESSAGES.pl],
  );
  // Допустимі збіги: назви, які однакові в усіх мовах
  assert.deepEqual(same.sort(), ['f_dr_adr', 'f_dr_udt', 'f_email', 'tpl_executive']);
  // жодних російських літер ы, э, ъ, ё
  for (const [k, v] of Object.entries(MESSAGES.uk)) assert.ok(!/[ыэъё]/i.test(v), k);
  // у значеннях немає латинських літер, вставлених усередину українських слів
  for (const [k, v] of Object.entries(MESSAGES.uk)) assert.ok(!/[а-яіїєґ][a-z]|[a-z][а-яіїєґ]/i.test(v), k);
});

test('przykładowe CV przechodzi wszystkie 8 reguł jakości', () => {
  const checks = qualityChecks(sampleCv(), 2);
  assert.equal(checks.length, 8);
  assert.deepEqual(checks.filter((c) => !c.ok).map((c) => c.key), []);
});

test('puste CV nie przechodzi reguł, a 3 strony łamią regułę stron', () => {
  const blank = qualityChecks(blankCv(), 1);
  // Z pustego CV przechodzi najwyżej reguła szablonu (ck_ats) i ewentualnie jedna inna
  assert.ok(blank.filter((c) => c.ok && c.key !== 'ck_ats').length <= 1);
  const long = qualityChecks(sampleCv(), 3);
  assert.equal(long.find((c) => c.key === 'ck_pages')?.ok, false);
});

test('pageCount: tolerancja 6 px i zaokrąglanie w górę', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(1123), 1);
  assert.equal(pageCount(1129), 1);
  assert.equal(pageCount(1130), 2);
  assert.equal(pageCount(2246), 2);
  assert.equal(pageCount(2300), 3);
});

test('normalizeCv naprawia uszkodzone dane i odrzuca nie-obiekty', () => {
  assert.equal(normalizeCv(null), null);
  assert.equal(normalizeCv('x'), null);
  assert.equal(normalizeCv([]), null);
  const cv = normalizeCv({
    id: 5,
    name: 'Test',
    tpl: 'nieznany',
    accent: 'pink',
    density: 1,
    lang: 'de',
    rodo: 'x',
    data: {
      basics: { name: 'Jan', email: 42 },
      experience: [{ role: 'Dev', current: 'tak' }, 'śmieć', null],
      languages: [{ name: 'Polski', level: 'Z9' }],
      skillsHard: ['nie string'],
    },
  });
  assert.ok(cv);
  assert.equal(cv.tpl, 'classic');
  assert.equal(cv.accent, 'navy');
  assert.equal(cv.density, 'normal');
  assert.equal(cv.lang, 'pl');
  assert.equal(cv.rodo, 'current');
  assert.equal(cv.data.basics.name, 'Jan');
  assert.equal(cv.data.basics.email, '');
  assert.equal(cv.data.experience.length, 1);
  assert.equal(cv.data.experience[0]?.current, false);
  assert.ok(cv.data.experience[0]?.id);
  assert.equal(cv.data.languages[0]?.level, 'B2');
  assert.equal(cv.data.skillsHard, '');
  assert.ok(cv.id.length > 0);
});

test('duplicateCv nadaje nowe identyfikatory i nie zostawia flagi przykładu', () => {
  const src = sampleCv();
  const cp = duplicateCv(src, 'kopia');
  assert.notEqual(cp.id, src.id);
  assert.equal(cp.example, false);
  assert.equal(cp.name, 'Frontend Developer – przykład (kopia)');
  assert.notEqual(cp.data.experience[0]?.id, src.data.experience[0]?.id);
  assert.equal(cp.data.experience[0]?.role, src.data.experience[0]?.role);
  cp.data.summary = 'zmiana';
  assert.notEqual(src.data.summary, 'zmiana');
});

test('PDF: wszystkie szablony zawierają nagłówki, klauzulę RODO i prawdziwy tekst', () => {
  for (const tpl of TEMPLATES) {
    const cv = sampleCv();
    cv.tpl = tpl;
    cv.rodo = 'future';
    const doc = buildPdfDocument(cv);
    const json = JSON.stringify(doc.content);
    assert.match(json, /Doświadczenie zawodowe/i, tpl);
    if (tpl !== 'panel') assert.match(json, /DOŚWIADCZENIE ZAWODOWE/, tpl);
    assert.match(json, /Anna Kowalska|ANNA KOWALSKA/, tpl);
    assert.match(json, /przyszłych rekrutacji/, tpl);
    assert.equal(doc.pageSize, 'A4');
    assert.equal(doc.footer(1, 1) && typeof doc.footer(1, 1), 'object');
    assert.match(JSON.stringify(doc.footer(2, 3)), /2 \/ 3/);
  }
});

test('PDF po angielsku używa angielskich nagłówków i GDPR', () => {
  const cv = sampleCv();
  cv.lang = 'en';
  const json = JSON.stringify(buildPdfDocument(cv).content);
  assert.match(json, /WORK EXPERIENCE/);
  assert.match(json, /GDPR/);
  assert.doesNotMatch(json, /obecnie/);
  assert.match(json, /present/);
});

test('pdfFileName usuwa polskie znaki', () => {
  const cv = sampleCv();
  cv.data.basics.name = 'Łukasz Żółć-Ąęśń';
  assert.equal(pdfFileName(cv), 'CV_Lukasz_Zolc_Aesn.pdf');
  cv.data.basics.name = '';
  cv.name = '???';
  assert.equal(pdfFileName(cv), 'CV_cv.pdf');
});

test('reducer: dodawanie, duplikowanie, usuwanie i aktualizacja bez mutacji stanu', () => {
  const a = blankCv('pl', 'A');
  let state: PersistedState = { cvs: [a], ui: 'pl', currentId: null };
  const b = blankCv('pl', 'B');
  state = reducer(state, { type: 'add', cv: b });
  assert.equal(state.cvs.length, 2);
  assert.equal(state.currentId, b.id);

  const before = state;
  const next = reducer(state, { type: 'update', id: a.id, mutate: (d) => { d.name = 'Zmieniona'; }, now: 123 });
  assert.equal(before.cvs[0]?.name, 'A');
  assert.equal(next.cvs[0]?.name, 'Zmieniona');
  assert.equal(next.cvs[0]?.updated, 123);
  assert.equal(next.cvs[1], before.cvs[1]);

  assert.equal(reducer(next, { type: 'update', id: 'brak', mutate: () => undefined }), next);

  const dup = reducer(next, { type: 'duplicate', id: a.id, copyLabel: 'kopia' });
  assert.equal(dup.cvs.length, 3);
  assert.equal(dup.cvs[2]?.name, 'Zmieniona (kopia)');

  const removed = reducer(dup, { type: 'remove', id: b.id });
  assert.equal(removed.cvs.length, 2);
  assert.equal(removed.currentId, null);
  assert.equal(reducer(removed, { type: 'ui', lang: 'en' }).ui, 'en');
});

test('persist: zapis i odczyt, uszkodzone dane, brak storage', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
  const cv = sampleCv();
  const state: PersistedState = { cvs: [cv], ui: 'en', currentId: cv.id };
  assert.equal(saveState(storage, state), true);
  const back = loadState(storage);
  assert.ok(back);
  assert.equal(back.ui, 'en');
  assert.equal(back.currentId, cv.id);
  assert.equal(back.cvs[0]?.data.basics.name, 'Anna Kowalska');

  store.set(STORAGE_KEY, '{nie json');
  assert.equal(loadState(storage), null);
  store.set(STORAGE_KEY, JSON.stringify({ cvs: 'x' }));
  assert.equal(loadState(storage), null);
  store.set(STORAGE_KEY, JSON.stringify({ cvs: [cv, 7, null], ui: 'xx', currentId: 'nie ma' }));
  const partial = loadState(storage);
  assert.equal(partial?.cvs.length, 1);
  assert.equal(partial?.ui, 'pl');
  assert.equal(partial?.currentId, null);

  assert.equal(loadState(null), null);
  assert.equal(saveState(null, state), false);
  assert.equal(
    saveState({ setItem: () => { throw new Error('QuotaExceeded'); } }, state),
    false,
  );
});

/* ---------- zdjęcie i szablony z portretem ---------- */

test('squareCrop: kwadrat z krótszego boku, x i y (0–100) przesuwają kadr', () => {
  const c = (x: number, y: number, zoom = 1) => ({ x, y, zoom });
  assert.deepEqual(squareCrop(400, 600, c(0, 0)), { sx: 0, sy: 0, size: 400 });
  assert.deepEqual(squareCrop(400, 600, c(50, 100)), { sx: 0, sy: 200, size: 400 });
  assert.deepEqual(squareCrop(400, 600, c(0, 50)), { sx: 0, sy: 100, size: 400 });
  assert.deepEqual(squareCrop(600, 400, c(50, 0)), { sx: 100, sy: 0, size: 400 });
  assert.deepEqual(squareCrop(500, 500, c(70, 70)), { sx: 0, sy: 0, size: 500 });
  // wartości spoza zakresu nie wypychają kadru poza obraz
  assert.equal(squareCrop(400, 600, c(0, 999)).sy, 200);
  assert.equal(squareCrop(400, 600, c(0, -5)).sy, 0);
  assert.equal(squareCrop(400, 600, c(Number.NaN, 0)).sx, 0);
});

test('squareCrop: przybliżenie zmniejsza kadr i zawsze mieści się w obrazie', () => {
  const r2 = squareCrop(400, 600, { x: 50, y: 30, zoom: 2 });
  assert.deepEqual(r2, { sx: 100, sy: 120, size: 200 });
  for (const zoom of [1, 1.5, 2, 3, 99]) {
    for (const x of [0, 50, 100]) {
      for (const y of [0, 30, 100]) {
        const r = squareCrop(300, 500, { x, y, zoom });
        assert.ok(r.sx >= 0 && r.sy >= 0 && r.sx + r.size <= 300 + 1e-9 && r.sy + r.size <= 500 + 1e-9, `${zoom} ${x} ${y}`);
      }
    }
  }
  assert.equal(squareCrop(400, 600, { x: 0, y: 0, zoom: 99 }).size, 400 / 3, 'zoom ograniczony do 3');
});

test('previewBox: podgląd CSS pokazuje ten sam kadr co squareCrop', () => {
  for (const [w, h] of [
    [400, 600],
    [600, 400],
    [500, 500],
  ] as const) {
    for (const crop of [
      { x: 0, y: 0, zoom: 1 },
      { x: 50, y: 30, zoom: 1 },
      { x: 100, y: 100, zoom: 2.5 },
      { x: 20, y: 80, zoom: 3 },
    ]) {
      const box = previewBox(w / h, crop);
      const r = squareCrop(w, h, crop);
      // ramka ma bok 100 jednostek, a widoczny fragment obrazu ma bok r.size,
      // więc skala to 100 / r.size jednostek na piksel źródła
      const k = 100 / r.size;
      assert.ok(Math.abs(box.width - w * k) < 1e-6, 'szerokość');
      assert.ok(Math.abs(box.height - h * k) < 1e-6, 'wysokość');
      assert.ok(Math.abs(box.left - -r.sx * k) < 1e-6, 'left');
      assert.ok(Math.abs(box.top - -r.sy * k) < 1e-6, 'top');
    }
  }
});

test('normalizePhotoView: naprawia wartości i czyta stary zapis photoPos', () => {
  assert.deepEqual(normalizePhotoView({}), PHOTO_DEFAULT);
  assert.deepEqual(normalizePhotoView({ photoX: 'a', photoZoom: Number.NaN }), PHOTO_DEFAULT);
  assert.deepEqual(normalizePhotoView({ photoX: 500, photoY: -4, photoZoom: 10, photoSize: 5 }), {
    x: 100,
    y: 0,
    zoom: 3,
    size: 70,
  });
  assert.deepEqual(normalizePhotoView({ photoPos: 80 }), { ...PHOTO_DEFAULT, x: 80, y: 80 });
  assert.equal(normalizePhotoView({ photoPos: 80, photoY: 10 }).y, 10);
});

test('fitWithin: zmniejsza, ale nie powiększa', () => {
  assert.deepEqual(fitWithin(4000, 3000, 640), { w: 640, h: 480 });
  assert.deepEqual(fitWithin(3000, 4000, 640), { w: 480, h: 640 });
  assert.deepEqual(fitWithin(300, 200, 640), { w: 300, h: 200 });
  assert.deepEqual(fitWithin(10000, 1, 640), { w: 640, h: 1 });
});

test('szablony: 15 sztuk, zdjęcie tylko w siedmiu, dwie kolumny tylko w trzech', () => {
  assert.equal(TEMPLATES.length, 15);
  assert.equal(new Set(TEMPLATES).size, 15);
  assert.deepEqual(
    TEMPLATES.filter((k) => TEMPLATE_META[k].photo),
    ['modern', 'executive', 'panel', 'nordic', 'driver', 'trades', 'student'],
  );
  assert.deepEqual(
    TEMPLATES.filter((k) => !TEMPLATE_META[k].atsSafe),
    ['creative', 'panel', 'nordic'],
  );
  // ocena ATS jest spójna z układem: niższa dokładnie dla szablonów z paskiem bocznym
  for (const k of TEMPLATES) assert.equal(TEMPLATE_META[k].ats === 'low', !TEMPLATE_META[k].atsSafe, k);
  assert.equal(qualityChecks({ ...sampleCv(), tpl: 'panel' }, 1).find((c) => c.key === 'ck_ats')?.ok, false);
  assert.equal(qualityChecks({ ...sampleCv(), tpl: 'technical' }, 1).find((c) => c.key === 'ck_ats')?.ok, true);
});

test('szablony: każdy ma nazwę, opis, dla kogo, plusy i ograniczenia po polsku i angielsku', () => {
  for (const lang of ['pl', 'en'] as const) {
    const m = MESSAGES[lang] as Record<string, string>;
    for (const k of TEMPLATES) {
      for (const key of ['tpl', 'tpl_desc', 'tpl_for', 'tpl_pro', 'tpl_con']) {
        assert.ok((m[`${key}_${k}`] ?? '').length > 3, `${lang}: ${key}_${k}`);
      }
    }
    for (const a of ['navy', 'azure', 'graphite', 'emerald', 'burgundy', 'crimson']) assert.ok(m[`acc_${a}`], `${lang}: acc_${a}`);
    for (const l of ['high', 'medium', 'low']) assert.ok(m[`ats_${l}`], `${lang}: ats_${l}`);
  }
});

test('stary szablon „portrait” wczytuje się jako Nordycki, nieznany jako Klasyczny', () => {
  const raw = JSON.parse(JSON.stringify(sampleCv())) as Record<string, unknown>;
  raw.tpl = 'portrait';
  assert.equal(normalizeCv(raw)?.tpl, 'nordic');
  raw.tpl = 'nie-ma-takiego';
  assert.equal(normalizeCv(raw)?.tpl, 'classic');
});

test('kolory: mieszanie i jasne tło paska bocznego', () => {
  assert.equal(mixHex('#000000', '#FFFFFF', 0.5), '#808080');
  assert.equal(mixHex('#1F3A5F', '#FFFFFF', 0), '#1F3A5F');
  assert.equal(mixHex('#1F3A5F', '#FFFFFF', 1), '#FFFFFF');
  assert.match(tint('#1F3A5F'), /^#[0-9A-F]{6}$/);
  assert.equal(mixHex('#000000', '#FFFFFF', 2), '#FFFFFF');
});

test('PDF: każdy szablon buduje się dla pustego CV, z wieloma stronami i ze zdjęciem', () => {
  const PNG = 'data:image/png;base64,AAAA';
  for (const tpl of TEMPLATES) {
    const empty = blankCv('pl', 'x', { tpl });
    assert.doesNotThrow(() => JSON.stringify(buildPdfDocument(empty).content), `${tpl} puste`);
    const full = sampleCv();
    full.tpl = tpl;
    full.data.experience = Array.from({ length: 12 }, () => ({ ...(full.data.experience[0] as (typeof full.data.experience)[number]) }));
    for (const photoPng of [undefined, PNG]) {
      const doc = buildPdfDocument(full, photoPng);
      assert.doesNotThrow(() => JSON.stringify(doc), tpl);
      doc.background?.(1);
      doc.background?.(2);
      assert.equal(typeof doc.footer(2, 3), 'object');
    }
    const withPhoto = buildPdfDocument(full, PNG);
    const hasImg = `${JSON.stringify(withPhoto.content)}${JSON.stringify(withPhoto.background?.(1) ?? null)}`.includes('"image"');
    assert.equal(hasImg, TEMPLATE_META[tpl].photo, `${tpl}: obrazek tylko w szablonach ze zdjęciem`);
  }
});

test('paski boczne: Panel, Kreatywny i Nordycki dzielą treść między kolumny bez dubli', () => {
  const L = DOC.pl;
  const cv = sampleCv();
  const titles = (tpl: 'panel' | 'creative' | 'nordic') => sideBlocks({ ...cv, tpl }, L).map((b) => b.title);
  assert.deepEqual(titles('panel'), [L.personal, L.lang, L.interests]);
  assert.deepEqual(titles('creative'), [L.personal, L.skills, L.lang]);
  assert.deepEqual(titles('nordic'), [L.personal, L.skills, L.lang, L.interests]);
  assert.deepEqual(sideBlocks({ ...cv, tpl: 'classic' }, L), []);
  for (const tpl of ['panel', 'creative', 'nordic'] as const) {
    const main = JSON.stringify(buildPdfDocument({ ...cv, tpl }).content);
    const has = mainHas(tpl);
    assert.equal(main.includes(L.skills.toUpperCase()) || main.includes(L.skills), has.skills, `${tpl}: umiejętności`);
    assert.equal(main.includes(L.interests.toUpperCase()) || main.includes(L.interests), has.interests, `${tpl}: zainteresowania`);
  }
  // szablony jednokolumnowe zawsze mają wszystko w głównej kolumnie
  assert.deepEqual(mainHas('classic'), { skills: true, langs: true, interests: true });
});

test('showsPhoto i klauzula RODO: wizerunek tylko gdy zdjęcie naprawdę jest w dokumencie', () => {
  const cv = sampleCv();
  assert.ok(cv.data.basics.photo.startsWith('data:image/'));
  cv.tpl = 'classic';
  assert.equal(showsPhoto(cv), false);
  assert.doesNotMatch(documentClause(cv), /wizerunku/);
  cv.tpl = 'nordic';
  assert.equal(showsPhoto(cv), true);
  assert.match(documentClause(cv), /w tym wizerunku/);
  cv.lang = 'en';
  assert.match(documentClause(cv), /including my image/);
  cv.data.basics.photo = '';
  assert.equal(showsPhoto(cv), false);
  assert.doesNotMatch(documentClause(cv), /image/);
  assert.match(rodoText(cv), /GDPR/);
});

test('extraDetails i sidebarRows: tylko wypełnione pola, w stałej kolejności', () => {
  const cv = blankCv();
  const L = DOC.pl;
  assert.deepEqual(extraDetails(cv.data.basics, L), []);
  assert.deepEqual(sidebarRows(cv.data.basics, L), []);
  Object.assign(cv.data.basics, {
    address: 'ul. Przykładowa 1',
    city: 'Gdańsk',
    phone: '+48 000 000 000',
    email: 'test@example.com',
    birthDate: '1.01.1990',
    license: 'B',
  });
  assert.deepEqual(
    extraDetails(cv.data.basics, L).map((r) => r.label),
    ['Adres', 'Data urodzenia', 'Prawo jazdy'],
  );
  const rows = sidebarRows(cv.data.basics, L);
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Adres', 'Telefon', 'E-mail', 'Data urodzenia', 'Prawo jazdy'],
  );
  assert.equal(rows[0]?.value, 'ul. Przykładowa 1, Gdańsk');
  assert.equal(sidebarRows(cv.data.basics, DOC.en)[0]?.label, 'Address');
});

test('normalizeCv: pola zdjęcia i danych dodatkowych są naprawiane', () => {
  const base = JSON.parse(JSON.stringify(sampleCv())) as ReturnType<typeof sampleCv>;
  // stary format (bez nowych pól) nadal się wczytuje
  const old = JSON.parse(JSON.stringify(base));
  for (const k of ['address', 'birthDate', 'birthPlace', 'license', 'photo', 'photoX', 'photoY', 'photoZoom', 'photoSize']) delete old.data.basics[k];
  const fromOld = normalizeCv(old);
  assert.ok(fromOld);
  assert.equal(fromOld.data.basics.photo, '');
  assert.equal(fromOld.data.basics.photoX, PHOTO_DEFAULT.x);
  assert.equal(fromOld.data.basics.photoY, PHOTO_DEFAULT.y);
  assert.equal(fromOld.data.basics.photoZoom, 1);
  assert.equal(fromOld.data.basics.photoSize, 100);
  // wersja z jednym polem photoPos (poprzednia wersja programu) zachowuje kadr
  const v1 = JSON.parse(JSON.stringify(base));
  delete v1.data.basics.photoX;
  delete v1.data.basics.photoY;
  v1.data.basics.photoPos = 64;
  assert.equal(normalizeCv(v1)?.data.basics.photoY, 64);
  assert.equal(fromOld.data.basics.address, '');
  // zdjęcie, które nie jest obrazem, jest odrzucane (np. wstrzyknięty javascript:)
  const evil = JSON.parse(JSON.stringify(base));
  evil.data.basics.photo = 'javascript:alert(1)';
  evil.data.basics.photoY = 9999;
  evil.data.basics.photoZoom = 50;
  evil.data.basics.photoSize = 1;
  const fixed = normalizeCv(evil);
  assert.ok(fixed);
  assert.equal(fixed.data.basics.photo, '');
  assert.equal(fixed.data.basics.photoY, 100);
  assert.equal(fixed.data.basics.photoZoom, 3);
  assert.equal(fixed.data.basics.photoSize, 70);
  // nieznany szablon wraca do klasycznego
  const badTpl = JSON.parse(JSON.stringify(base));
  badTpl.tpl = 'nope';
  assert.equal(normalizeCv(badTpl)?.tpl, 'classic');
  const panel = JSON.parse(JSON.stringify(base));
  panel.tpl = 'panel';
  assert.equal(normalizeCv(panel)?.tpl, 'panel');
});

test('duplicateCv zachowuje zdjęcie', () => {
  const src = sampleCv();
  const copy = duplicateCv(src, 'kopia');
  assert.equal(copy.data.basics.photo, src.data.basics.photo);
  assert.notEqual(copy.id, src.id);
});

test('PDF Executive: nagłówek w dwóch kolumnach ze zdjęciem, bez zdjęcia bez obrazka', () => {
  const cv = sampleCv();
  cv.tpl = 'executive';
  const withPhoto = JSON.stringify(buildPdfDocument(cv, 'data:image/png;base64,AAAA').content);
  assert.match(withPhoto, /"image":"data:image\/png;base64,AAAA"/);
  const without = JSON.stringify(buildPdfDocument(cv).content);
  assert.doesNotMatch(without, /"image"/);
  cv.tpl = 'classic';
  assert.doesNotMatch(JSON.stringify(buildPdfDocument(cv, 'data:image/png;base64,AAAA').content), /"image"/);
});

test('PDF panel: pasek rysowany na każdej stronie, treść paska tylko na pierwszej, marginesy zostawiają miejsce', () => {
  const cv = sampleCv();
  cv.tpl = 'panel';
  cv.data.basics.address = 'ul. Przykładowa 1';
  const doc = buildPdfDocument(cv, 'data:image/png;base64,AAAA');
  assert.ok(doc.pageMargins[0] > 176, 'lewy margines musi być szerszy niż pasek');
  assert.ok(doc.background);
  const p1 = JSON.stringify(doc.background(1));
  const p2 = JSON.stringify(doc.background(2));
  assert.match(p1, /"type":"rect"/);
  assert.match(p2, /"type":"rect"/);
  assert.match(p1, /Dane osobowe/);
  assert.match(p1, /Języki/);
  assert.match(p1, /Zainteresowania/);
  assert.match(p1, /ul\. Przykładowa 1/);
  assert.match(p1, /"image":"data:image\/png;base64,AAAA"/);
  assert.doesNotMatch(p2, /Dane osobowe/);
  // języki i zainteresowania są w pasku, więc nie powtarzają się w treści głównej
  assert.doesNotMatch(JSON.stringify(doc.content), /Języki|Zainteresowania/);
  // inne szablony nie mają tła
  cv.tpl = 'classic';
  assert.equal(buildPdfDocument(cv).background, undefined);
});

test('PDF: rozmiar zdjęcia skaluje się z photoSize, a w panelu nie przekracza paska', () => {
  const cv = sampleCv();
  cv.tpl = 'executive';
  const diam = (c: typeof cv) => {
    const json = JSON.stringify(buildPdfDocument(c, 'data:image/png;base64,AAAA').content);
    return Number(json.match(/"width":(\d+),"image"/)?.[1]);
  };
  assert.equal(diam(cv), 84);
  cv.data.basics.photoSize = 125;
  assert.equal(diam(cv), 105);
  cv.data.basics.photoSize = 70;
  assert.equal(diam(cv), 59);
  cv.tpl = 'panel';
  cv.data.basics.photoSize = 125;
  const bg = JSON.stringify(buildPdfDocument(cv, 'data:image/png;base64,AAAA').background?.(1));
  const w = Number(bg.match(/"width":(\d+),"height":\d+,"alignment":"center"/)?.[1]);
  assert.ok(w > 0 && w <= 176 - 36, `szerokość w panelu: ${w}`);
  cv.data.basics.photoSize = 100;
  assert.match(JSON.stringify(buildPdfDocument(cv, 'data:image/png;base64,AAAA').background?.(1)), /"width":108,"height":108/);
});

test('panBy: zdjęcie jedzie za palcem, kadr w przeciwną stronę, bez wyjścia poza obraz', () => {
  const crop = { x: 50, y: 50, zoom: 2 };
  // pionowe zdjęcie 400×600, zoom 2: okno ma 200 px, luz w poziomie 200 px (ramka = 200 px)
  const right = panBy(400 / 600, crop, 0.25, 0);
  assert.ok(right.x < 50, 'palec w prawo → okno w lewo');
  const left = panBy(400 / 600, crop, -0.25, 0);
  assert.ok(left.x > 50);
  assert.equal(panBy(400 / 600, crop, 100, 100).x, 0, 'ograniczone do krawędzi');
  assert.equal(panBy(400 / 600, crop, -100, -100).y, 100);
  // przy zoom 1 krótsza oś nie ma luzu: nie ruszamy jej
  const flat = panBy(400 / 600, { x: 37, y: 20, zoom: 1 }, 0.3, 0.3);
  assert.equal(flat.x, 37);
  assert.notEqual(flat.y, 20);
  // przesunięcie o całą ramkę przy zoom 2 zmienia kadr dokładnie o jego rozmiar
  const r0 = squareCrop(400, 600, crop);
  const r1 = squareCrop(400, 600, panBy(400 / 600, crop, 0.25, 0));
  assert.ok(Math.abs(r0.sx - r1.sx - 0.25 * r0.size) < 1e-6);
});

test('zoomAt: punkt pod palcami zostaje na miejscu', () => {
  for (const [w, h] of [
    [400, 600],
    [600, 400],
    [500, 500],
  ] as const) {
    for (const f of [
      [0.5, 0.5],
      [0.2, 0.8],
      [0.9, 0.1],
    ] as const) {
      const start = { x: 40, y: 60, zoom: 1.4 };
      const next = zoomAt(w / h, start, 2.2, f[0], f[1]);
      const a = squareCrop(w, h, start);
      const b = squareCrop(w, h, next);
      const px = (r: typeof a, ff: number, axis: 'sx' | 'sy') => r[axis] + ff * r.size;
      // punkt pod palcem w pikselach źródła przed i po (o ile okno nie dobiło do krawędzi)
      const atEdge = (v: number) => v <= 0.0001 || v >= 99.9999;
      if (!atEdge(next.x) && !atEdge(next.y)) {
        assert.ok(Math.abs(px(a, f[0], 'sx') - px(b, f[0], 'sx')) < 1e-6, `x ${w}x${h} ${f}`);
        assert.ok(Math.abs(px(a, f[1], 'sy') - px(b, f[1], 'sy')) < 1e-6, `y ${w}x${h} ${f}`);
      }
      assert.equal(next.zoom, 2.2);
    }
  }
  assert.equal(zoomAt(1, { x: 50, y: 50, zoom: 1 }, 99).zoom, 3);
  assert.equal(zoomAt(1, { x: 50, y: 50, zoom: 2 }, 0.1).zoom, 1);
  // zoom 1 na kwadracie: pozycja nie ma sensu, więc zostaje bez zmian
  const sq = zoomAt(1, { x: 12, y: 34, zoom: 2 }, 1);
  assert.equal(sq.zoom, 1);
  assert.deepEqual([sq.x, sq.y], [12, 34]);
});

test('bytesToBase64: zgodne z Buffer, także dla dużych danych i pustych', () => {
  assert.equal(bytesToBase64(new Uint8Array()), '');
  assert.equal(bytesToBase64(new TextEncoder().encode('%PDF-1.4 zażółć')), Buffer.from('%PDF-1.4 zażółć').toString('base64'));
  const big = new Uint8Array(300_000).map((_, i) => (i * 7) % 256);
  assert.equal(bytesToBase64(big), Buffer.from(big).toString('base64'));
});

test('blankCv: szablon i kolor z galerii trafiają do nowego CV', () => {
  const cv = blankCv('pl', 'Nowe', { tpl: 'panel', accent: 'emerald' });
  assert.equal(cv.tpl, 'panel');
  assert.equal(cv.accent, 'emerald');
  assert.equal(blankCv().tpl, 'classic');
  assert.equal(blankCv('pl', '', { tpl: 'nordic' }).accent, 'navy');
  // każdy szablon ma opis w galerii w obu językach
  for (const k of TEMPLATES) {
    assert.ok((MESSAGES.pl as Record<string, string>)[`tpl_desc_${k}`], `pl ${k}`);
    assert.ok((MESSAGES.en as Record<string, string>)[`tpl_desc_${k}`], `en ${k}`);
  }
});

test('errorText: czyta komunikat z Error, obiektu wtyczki i napisu; PdfStageError dodaje etap', () => {
  assert.equal(errorText(new Error('zepsute')), 'zepsute');
  assert.equal(errorText({ message: 'Permission denied' }), 'Permission denied');
  assert.equal(errorText({ errorMessage: 'inny' }), 'inny');
  assert.equal(errorText('tekst'), 'tekst');
  assert.equal(errorText(null), 'unknown error');
  assert.equal(errorText({}), 'unknown error');
  assert.equal(new PdfStageError('share', { message: 'FileUriExposed' }).message, 'share: FileUriExposed');
});

test('vfsFromScript: czyta czcionki pdfmake niezależnie od „this” i modułów', () => {
  // dokładnie ten kształt ma pdfmake/build/vfs_fonts.js (0.2.x)
  const real = 'this.pdfMake = this.pdfMake || {}; this.pdfMake.vfs = {"Roboto-Regular.ttf": "AAEAAA", "Roboto-Medium.ttf": "BBB"};';
  assert.equal(vfsFromScript(real)['Roboto-Regular.ttf'], 'AAEAAA');
  // wywołane w trybie ścisłym (jak w module ES) nadal działa, bo „this” podajemy sami
  assert.equal(vfsFromScript('"use strict";' + real)['Roboto-Medium.ttf'], 'BBB');
  // inne warianty eksportu
  assert.equal(vfsFromScript('module.exports = {"Roboto-Regular.ttf": "x"};')['Roboto-Regular.ttf'], 'x');
  assert.equal(vfsFromScript('exports.pdfMake = {vfs: {"Roboto-Regular.ttf": "y"}};')['Roboto-Regular.ttf'], 'y');
  // nieznany kształt to czytelny błąd, a nie cichy PDF bez czcionek
  assert.throws(() => vfsFromScript('var a = 1;'), /nieoczekiwany format/);
  assert.throws(() => vfsFromScript('this.pdfMake = {vfs: {}};'), /nieoczekiwany format/);
});

test('kopia zapasowa: zapis i odczyt bez utraty danych, przykład pomijany', () => {
  const own = blankCv('pl', 'Moje CV');
  own.data.basics.name = 'Jan Testowy';
  own.data.basics.photo = 'data:image/png;base64,AAAA';
  own.data.basics.photoZoom = 2;
  const back = parseBackup(serializeBackup([own, sampleCv()], Date.UTC(2026, 9, 26)));
  assert.ok(back.ok);
  if (!back.ok) return;
  assert.equal(back.cvs.length, 1);
  assert.deepEqual(back.cvs[0], own);
});

test('kopia zapasowa: obce i uszkodzone pliki są odrzucane', () => {
  for (const bad of ['', 'nie json', '[]', '{}', '{"app":"inna","version":1,"cvs":[]}', `{"app":"${BACKUP_APP}","version":99,"cvs":[]}`]) {
    const r = parseBackup(bad);
    assert.equal(r.ok, false, bad);
    if (!r.ok) assert.equal(r.reason, 'format');
  }
  const r = parseBackup(`{"app":"${BACKUP_APP}","version":1,"cvs":[]}`);
  assert.ok(!r.ok && r.reason === 'empty');
  // zepsute pola są naprawiane, nie powodują błędu
  const fixed = parseBackup(`{"app":"${BACKUP_APP}","version":1,"cvs":[{"id":"a","tpl":"nope","data":{"basics":{"name":5}}}]}`);
  assert.ok(fixed.ok && fixed.cvs[0]?.data.basics.name === '');
});

test('kopia zapasowa: ponowne wczytanie nie dubluje, inna wersja nie nadpisuje', () => {
  const a = blankCv('pl', 'A');
  const b = blankCv('pl', 'B');
  assert.deepEqual(planImport([a], [a, b]), { toAdd: [b], skipped: 1 });
  const newer = { ...structuredClone(a), updated: a.updated + 1000, name: 'A nowsze' };
  const plan = planImport([a], [newer]);
  assert.equal(plan.toAdd.length, 1);
  assert.notEqual(plan.toAdd[0]?.id, a.id);
  assert.equal(plan.toAdd[0]?.name, 'A nowsze');
  assert.equal(backupFileName(new Date(2026, 9, 5).getTime()), 'cv-maker-kopia-2026-10-05.json');
});

test('dostęp do PDF: reklama, kredyt, premium i wersja bez blokady', () => {
  assert.equal(decideExport(FREE_ACCESS, false), 'free');
  assert.equal(decideExport(FREE_ACCESS, true), 'needs-ad');
  assert.equal(decideExport({ ...FREE_ACCESS, pro: true }, true), 'premium');
  let s = grantCredit(FREE_ACCESS, 3);
  assert.equal(decideExport(s, true), 'credit');
  s = consumeCredit(s);
  assert.equal(decideExport(s, true), 'needs-ad');
  assert.equal(consumeCredit(s).credits, 0); // nie schodzi poniżej zera
  let many = FREE_ACCESS;
  for (let i = 0; i < 10; i++) many = grantCredit(many, 3);
  assert.equal(many.credits, 3); // limit zapasu
});

test('dostęp do PDF: uszkodzony zapis nigdy nie daje darmowego dostępu ani błędu', () => {
  assert.deepEqual(normalizeAccess(null, 3), FREE_ACCESS);
  assert.deepEqual(normalizeAccess('x', 3), FREE_ACCESS);
  assert.deepEqual(normalizeAccess({ premium: 'yes', credits: -4 }, 3), FREE_ACCESS);
  assert.deepEqual(normalizeAccess({ premium: true, credits: 99.9 }, 3), { ...FREE_ACCESS, pro: true, credits: 3 });
  assert.deepEqual(normalizeAccess({ credits: NaN }, 3), FREE_ACCESS);
  const mem = new Map<string, string>();
  const st = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  assert.deepEqual(loadAccess(st, 3), FREE_ACCESS);
  saveAccess(st, { ...FREE_ACCESS, credits: 2 });
  assert.deepEqual(loadAccess(st, 3), { ...FREE_ACCESS, credits: 2 });
  mem.set(ACCESS_KEY, '{oops');
  assert.deepEqual(loadAccess(st, 3), FREE_ACCESS);
  assert.deepEqual(loadAccess(null, 3), FREE_ACCESS);
});

/* ---------- redesign interfejsu: czysta logika pomocnicza ---------- */

test('completeness: puste CV ma 0 z 6, przykład ma komplet', async () => {
  const { completeness, sectionFilled } = await import('../src/domain/completeness.ts');
  const empty = blankCv('pl', 'x');
  assert.deepEqual(completeness(empty), { done: 0, total: 6 });
  assert.equal(sectionFilled(empty, 'rodo'), true);
  assert.equal(sectionFilled(empty, 'photo'), false);
  assert.deepEqual(completeness(sampleCv()), { done: 6, total: 6 });
});

test('completeness: kontakt wymaga imienia i e-maila lub telefonu', async () => {
  const { sectionFilled } = await import('../src/domain/completeness.ts');
  const c = blankCv('pl', 'x');
  c.data.basics.name = 'Jan';
  assert.equal(sectionFilled(c, 'basics'), false);
  c.data.basics.phone = '600 000 000';
  assert.equal(sectionFilled(c, 'basics'), true);
  c.data.skillsSoft = 'komunikacja';
  assert.equal(sectionFilled(c, 'skills'), true);
});

test('walidacja pól: e-mail, miesiąc, rok i kolejność dat; puste pole nie jest błędem', async () => {
  const { emailProblem, monthProblem, yearProblem, rangeProblem } = await import('../src/domain/validation.ts');
  assert.equal(emailProblem(''), false);
  assert.equal(emailProblem('jan@example.com'), false);
  assert.equal(emailProblem('jan@example'), true);
  assert.equal(emailProblem('jan example@x.pl'), true);
  assert.equal(monthProblem(''), false);
  assert.equal(monthProblem('03.2022'), false);
  assert.equal(monthProblem('3/2022'), false);
  assert.equal(monthProblem('2022'), false);
  assert.equal(monthProblem('13.2022'), true);
  assert.equal(monthProblem('marzec 2022'), true);
  assert.equal(yearProblem('2020'), false);
  assert.equal(yearProblem('20'), true);
  assert.equal(rangeProblem('03.2022', '01.2021'), true);
  assert.equal(rangeProblem('03.2022', '05.2022'), false);
  assert.equal(rangeProblem('03.2022', '01.2021', true), false);
  assert.equal(rangeProblem('03.2022', 'xx'), false);
});

test('motyw: nieznane wartości dają „system", zapis i odczyt, brak storage', async () => {
  const { normalizeTheme, loadTheme, saveTheme, THEME_KEY } = await import('../src/domain/theme.ts');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('neon'), 'system');
  assert.equal(normalizeTheme(null), 'system');
  const mem = new Map<string, string>();
  const st = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  };
  assert.equal(saveTheme(st, 'dark'), true);
  assert.equal(mem.get(THEME_KEY), 'dark');
  assert.equal(loadTheme(st), 'dark');
  saveTheme(st, 'system');
  assert.equal(mem.has(THEME_KEY), false);
  assert.equal(loadTheme(null), 'system');
  assert.equal(saveTheme(null, 'dark'), false);
});

test('wyszukiwanie CV: bez diakrytyków, wiele słów, nazwa szablonu; sortowanie', async () => {
  const { matchesCv, sortCvs, fold } = await import('../src/domain/search.ts');
  const c = blankCv('pl', 'Wersja Łódź');
  c.data.basics.name = 'Żaneta Kowalska';
  c.data.basics.title = 'Specjalista HR';
  assert.equal(fold('Łódź Żółć'), 'lodz zolc');
  assert.equal(matchesCv(c, '', 'Klasyczny'), true);
  assert.equal(matchesCv(c, 'lodz', 'Klasyczny'), true);
  assert.equal(matchesCv(c, 'zaneta hr', 'Klasyczny'), true);
  assert.equal(matchesCv(c, 'klasyczny', 'Klasyczny'), true);
  assert.equal(matchesCv(c, 'programista', 'Klasyczny'), false);
  const a = { name: 'b', updated: 1 };
  const b = { name: 'a', updated: 5 };
  assert.deepEqual(sortCvs([a, b], 'recent', 'pl'), [b, a]);
  assert.deepEqual(sortCvs([a, b], 'name', 'pl'), [b, a]);
  assert.deepEqual(sortCvs([b, a], 'name', 'pl'), [b, a]);
});

test('isUnimplementedError: rozpoznaje brak wtyczki natywnej, także w PdfStageError', () => {
  assert.equal(isUnimplementedError({ code: 'UNIMPLEMENTED', message: 'x' }), true);
  assert.equal(isUnimplementedError({ message: '"SaveFile" plugin is not implemented on android' }), true);
  assert.equal(isUnimplementedError(new PdfStageError('save', { code: 'UNIMPLEMENTED' })), true);
  assert.equal(isUnimplementedError({ message: 'Save failed: boom' }), false);
  assert.equal(isUnimplementedError(new Error('disk full')), false);
  assert.equal(isUnimplementedError(undefined), false);
});

test('isBlank: puste CV jest puste, wpisane imię lub treść to już nie', async () => {
  const { isBlank } = await import('../src/domain/completeness.ts');
  const c = blankCv('pl', 'x');
  assert.equal(isBlank(c), true);
  c.data.basics.name = 'Jan';
  assert.equal(isBlank(c), false);
  const d = blankCv('pl', 'y');
  d.data.summary = 'Opis';
  assert.equal(isBlank(d), false);
  assert.equal(isBlank(sampleCv()), false);
});

test('isBlank: samo zdjęcie lub pole dodatkowe to nie puste CV; ustawienia i RODO nie liczą się', async () => {
  const { isBlank } = await import('../src/domain/completeness.ts');
  const photo = blankCv('pl', 'p');
  photo.data.basics.photo = 'data:image/jpeg;base64,AAAA';
  assert.equal(isBlank(photo), false);
  for (const field of ['address', 'birthDate', 'birthPlace', 'license'] as const) {
    const c = blankCv('pl', field);
    c.data.basics[field] = 'x';
    assert.equal(isBlank(c), false, field);
  }
  const settings = blankCv('pl', 's');
  settings.accent = 'graphite';
  settings.density = 'compact';
  settings.tpl = 'ats';
  settings.rodo = 'future';
  settings.rodoTarget = 'Frontend Developer';
  assert.equal(isBlank(settings), true);
});
