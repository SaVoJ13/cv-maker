import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blankCv, duplicateCv, normalizeCv, sampleCv } from '../src/domain/cvOps.ts';
import { isBlank } from '../src/domain/completeness.ts';
import { BACKUP_APP, parseBackup, serializeBackup } from '../src/domain/backup.ts';
import { cvSearchText } from '../src/domain/atsScanner.ts';
import { STORAGE_KEY, loadState, saveState } from '../src/store/persist.ts';

const V1_STATE_TEXT = readFileSync(new URL('./fixtures/v1-state.json', import.meta.url), 'utf8');
const V1_BACKUP_TEXT = readFileSync(new URL('./fixtures/v1-backup.json', import.meta.url), 'utf8');

function memStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

test('courses: нове CV порожнє; демо-дані лише в прикладі (друкуються тільки в шаблоні Student)', () => {
  assert.equal(blankCv().data.courses, '');
  assert.match(sampleCv().data.courses, /Kurs Excel/);
});

test('normalizeCv: старе CV без courses отримує порожній рядок, інші поля не змінюються', () => {
  const old = JSON.parse(JSON.stringify(blankCv())) as Record<string, any>;
  delete old.data.courses;
  old.data.summary = 'Zachowane';
  old.data.interests = 'Szachy';
  const cv = normalizeCv(old);
  assert.ok(cv);
  assert.equal(cv.data.courses, '');
  assert.equal(cv.data.summary, 'Zachowane');
  assert.equal(cv.data.interests, 'Szachy');
});

test('normalizeCv: збережене значення courses лишається, не-рядок стає порожнім', () => {
  const cv = blankCv();
  cv.data.courses = 'Kurs Excel (online)\nBHP';
  assert.equal(normalizeCv(cv)?.data.courses, 'Kurs Excel (online)\nBHP');
  for (const bad of [5, null, ['a'], { x: 1 }, true]) {
    const raw = JSON.parse(JSON.stringify(cv)) as Record<string, any>;
    raw.data.courses = bad;
    assert.equal(normalizeCv(raw)?.data.courses, '', String(bad));
  }
});

test('v1-стан з реальними CV відкривається, courses порожнє, дані не втрачено', () => {
  const state = loadState(memStorage({ [STORAGE_KEY]: V1_STATE_TEXT }));
  assert.ok(state);
  assert.ok(state.cvs.length >= 1);
  for (const cv of state.cvs) assert.equal(cv.data.courses, '');
  const original = (JSON.parse(V1_STATE_TEXT) as { cvs: Record<string, any>[] }).cvs;
  state.cvs.forEach((cv, i) => {
    assert.equal(cv.data.summary, original[i].data.summary);
    assert.equal(cv.data.skillsHard, original[i].data.skillsHard);
  });
});

test('старий бекап версії 1 читається, courses порожнє', () => {
  const r = parseBackup(V1_BACKUP_TEXT);
  assert.ok(r.ok);
  for (const cv of r.cvs) assert.equal(cv.data.courses, '');
});

test('бекап: courses входить у файл і повертається після відновлення', () => {
  const cv = blankCv();
  cv.data.basics.name = 'Student';
  cv.data.courses = 'Kurs pierwszej pomocy\nKurs Excel';
  const text = serializeBackup([cv, sampleCv()]);
  const file = JSON.parse(text) as { app: string; cvs: { data: { courses: string } }[] };
  assert.equal(file.app, BACKUP_APP);
  assert.equal(file.cvs[0].data.courses, 'Kurs pierwszej pomocy\nKurs Excel');
  const back = parseBackup(text);
  assert.ok(back.ok);
  assert.equal(back.cvs[0].data.courses, 'Kurs pierwszej pomocy\nKurs Excel');
});

test('збереження стану: courses переживає запис і читання, стан лишається schema 2', () => {
  const cv = blankCv();
  cv.data.courses = 'Kurs A';
  const st = memStorage();
  saveState(st, { cvs: [cv], ui: 'pl', currentId: cv.id });
  assert.equal((JSON.parse(st.store.get(STORAGE_KEY)!) as { schema: number }).schema, 2);
  assert.equal(loadState(st)?.cvs[0].data.courses, 'Kurs A');
});

test('дублювання CV копіює courses', () => {
  const cv = blankCv();
  cv.data.courses = 'Kurs B';
  assert.equal(duplicateCv(cv, 'kopia').data.courses, 'Kurs B');
});

test('isBlank і ATS рахують courses лише там, де шаблон їх друкує (дані при цьому не змінюються)', () => {
  const cv = blankCv();
  cv.data.courses = 'Kurs obsługi wózka widłowego';
  assert.equal(isBlank(cv), true, 'classic не друкує курси');
  assert.doesNotMatch(cvSearchText(cv.data), /wózka widłowego/);
  assert.equal(cv.data.courses, 'Kurs obsługi wózka widłowego');
  const student = { ...cv, tpl: 'student' as never };
  assert.equal(isBlank(student), false, 'student друкує курси');
});
