import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { BACKUP_APP, parseBackup, planImport, serializeBackup } from '../src/domain/backup.ts';
import { SCHEMA_PREFIX } from '../src/domain/schema.ts';
import { SNAPSHOT_KEY, STORAGE_KEY, loadState, saveState } from '../src/store/persist.ts';
import type { Cv } from '../src/domain/types.ts';

/** Реальні дані формату v1 (без schema, з шаблоном portrait, з фото та старим photoPos). */
const V1_STATE_TEXT = readFileSync(new URL('./fixtures/v1-state.json', import.meta.url), 'utf8');
const V1_BACKUP_TEXT = readFileSync(new URL('./fixtures/v1-backup.json', import.meta.url), 'utf8');
const V1_STATE = JSON.parse(V1_STATE_TEXT) as { cvs: Record<string, any>[]; ui: string; currentId: string };

function memStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

/** Усі поля, які були в v1, мають лишитися незмінними. */
function assertV1FieldsKept(migrated: Cv, original: Record<string, any>) {
  assert.equal(migrated.id, original.id);
  assert.equal(migrated.name, original.name);
  assert.equal(migrated.updated, original.updated);
  assert.equal(migrated.lang, original.lang);
  assert.equal(migrated.accent, original.accent);
  assert.equal(migrated.density, original.density);
  assert.equal(migrated.rodo, original.rodo);
  assert.equal(migrated.rodoTarget, original.rodoTarget);
  assert.equal(migrated.example, original.example);
  const o = original.data;
  const d = migrated.data;
  assert.equal(d.summary, o.summary);
  assert.equal(d.skillsHard, o.skillsHard);
  assert.equal(d.skillsSoft, o.skillsSoft);
  assert.equal(d.interests, o.interests);
  assert.deepEqual(d.experience, o.experience);
  assert.deepEqual(d.education, o.education);
  assert.deepEqual(d.languages, o.languages);
  for (const k of ['name', 'title', 'email', 'phone', 'city', 'link', 'address', 'birthDate', 'birthPlace', 'license', 'photo']) {
    assert.equal((d.basics as any)[k], o.basics[k], `basics.${k}`);
  }
}

test('v1-стан: кілька CV, portrait, фото — відкривається без втрат у v2', () => {
  const st = memStorage({ [STORAGE_KEY]: V1_STATE_TEXT });
  const state = loadState(st);
  assert.ok(state);
  assert.equal(state.cvs.length, 3);
  assert.equal(state.ui, 'pl');
  assert.equal(state.currentId, 'f9e8d7c6');
  state.cvs.forEach((cv, i) => assertV1FieldsKept(cv, V1_STATE.cvs[i]!));

  const [driver, dev, example] = state.cvs as [Cv, Cv, Cv];
  assert.equal(driver.tpl, 'nordic', 'portrait → nordic');
  assert.match(driver.data.basics.photo, /^data:image\/png;base64,/);
  assert.equal(driver.data.basics.photoX, 40, 'старий photoPos перейшов у photoX');
  assert.equal(driver.data.basics.photoY, 40, 'старий photoPos перейшов у photoY');
  assert.equal(driver.data.basics.photoZoom, 1.5);
  assert.equal(driver.rodo, 'future');
  assert.equal(dev.tpl, 'modern');
  assert.equal(dev.data.basics.photo, '');
  assert.equal(example.example, true);

  // нові поля мають значення за замовчуванням, ніщо не зламано
  for (const cv of state.cvs) {
    assert.equal(cv.autoFit, false);
    assert.equal(cv.data.basics.photoShape, 'circle');
    assert.deepEqual(cv.data.extras, {});
  }
});

test('v1-стан: знімок зберігається, запис іде у v2, повторне читання дає той самий результат', () => {
  const st = memStorage({ [STORAGE_KEY]: V1_STATE_TEXT });
  const state = loadState(st)!;
  assert.equal(saveState(st, state), true);
  assert.equal(st.store.get(SNAPSHOT_KEY), V1_STATE_TEXT, 'знімок = точна копія старого запису');
  assert.ok(st.store.get(STORAGE_KEY)!.startsWith(SCHEMA_PREFIX));
  assert.deepEqual(loadState(st), state);
  // відновлення зі знімка дає той самий стан, що й прямо зі старого запису
  const restored = loadState(memStorage({ [STORAGE_KEY]: st.store.get(SNAPSHOT_KEY)! }));
  assert.deepEqual(restored, state);
});

test('v1-стан: PDF будується для кожного мігрованого CV, зокрема з фото на nordic', () => {
  const state = loadState(memStorage({ [STORAGE_KEY]: V1_STATE_TEXT }))!;
  for (const cv of state.cvs) {
    const png = cv.data.basics.photo || undefined;
    const doc = buildPdfDocument(cv, png);
    assert.ok(JSON.stringify(doc.content).includes(cv.data.basics.name), cv.name);
  }
});

test('старий бекап free-cv-backup версії 1: читається, дані не губляться', () => {
  assert.equal(JSON.parse(V1_BACKUP_TEXT).app, BACKUP_APP);
  assert.equal(JSON.parse(V1_BACKUP_TEXT).version, 1);
  const r = parseBackup(V1_BACKUP_TEXT);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.cvs.length, 2);
  r.cvs.forEach((cv, i) => assertV1FieldsKept(cv, V1_STATE.cvs[i]!));
  assert.equal(r.cvs[0]!.tpl, 'nordic');
  assert.equal(r.cvs[0]!.data.basics.photoX, 40);
  assert.equal(r.cvs[0]!.autoFit, false);
  assert.equal(r.cvs[0]!.data.basics.photoShape, 'circle');
  assert.ok(r.cvs.every((c) => c.example === false));
});

test('старий бекап v1: повторний імпорт нічого не дублює, а новіша версія CV не перезаписує наявну', () => {
  const state = loadState(memStorage({ [STORAGE_KEY]: V1_STATE_TEXT }))!;
  const r = parseBackup(V1_BACKUP_TEXT);
  assert.ok(r.ok);
  if (!r.ok) return;
  const plan = planImport(state.cvs, r.cvs);
  assert.equal(plan.toAdd.length, 0);
  assert.equal(plan.skipped, 2);
});

test('бекап: новий запис містить лише очікувані ключі й читається назад; бекап із майбутньої версії відхиляється', () => {
  const state = loadState(memStorage({ [STORAGE_KEY]: V1_STATE_TEXT }))!;
  const text = serializeBackup(state.cvs, 5);
  const back = parseBackup(text);
  assert.ok(back.ok);
  if (!back.ok) return;
  assert.equal(back.cvs.length, 2, 'приклад у бекап не входить');
  assert.deepEqual(back.cvs.map((c) => c.data), state.cvs.filter((c) => !c.example).map((c) => c.data));
  const future = JSON.stringify({ ...JSON.parse(V1_BACKUP_TEXT), version: 99 });
  assert.deepEqual(parseBackup(future), { ok: false, reason: 'format' });
});
