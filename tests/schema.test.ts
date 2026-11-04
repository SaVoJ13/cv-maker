import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SCHEMA, SCHEMA_PREFIX, migrateState, schemaOf, serializeState } from '../src/domain/schema.ts';
import { normalizeExtras } from '../src/domain/extras.ts';
import { blankCv, normalizeCv } from '../src/domain/cvOps.ts';
import { SNAPSHOT_KEY, STORAGE_KEY, loadState, saveState } from '../src/store/persist.ts';

function memStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
}

const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';
/** Мінімальний v1-запис: без schema, без extras/photoShape/autoFit, старий шаблон portrait. */
const v1Raw = () =>
  JSON.stringify({
    cvs: [
      { id: 'a1', name: 'Старе', updated: 1, lang: 'pl', tpl: 'portrait', accent: 'navy', density: 'normal',
        rodo: 'current', rodoTarget: '', example: false,
        data: { basics: { name: 'Jan', photo: PHOTO, photoX: 30 }, summary: 'x', experience: [], education: [],
                skillsHard: 'JS', skillsSoft: '', languages: [], interests: '' } },
    ],
    ui: 'en',
    currentId: 'a1',
  });

test('schemaOf: без поля schema це v1', () => {
  assert.equal(schemaOf({ cvs: [] }), 1);
  assert.equal(schemaOf(null), 1);
  assert.equal(schemaOf({ schema: 2 }), 2);
  assert.equal(schemaOf({ schema: 'x' }), 1);
});

test('migrateState: v1 читається без втрат, нові поля отримують значення за замовчуванням', () => {
  const s = migrateState(JSON.parse(v1Raw()));
  assert.ok(s);
  const cv = s.cvs[0]!;
  assert.equal(cv.tpl, 'nordic');
  assert.equal(cv.data.basics.photo, PHOTO);
  assert.equal(cv.data.basics.photoX, 30);
  assert.equal(cv.data.basics.photoShape, 'circle');
  assert.equal(cv.autoFit, false);
  assert.deepEqual(cv.data.extras, {});
  assert.equal(s.ui, 'en');
  assert.equal(s.currentId, 'a1');
  assert.equal(migrateState('x'), null);
  assert.equal(migrateState({ cvs: 5 }), null);
});

test('serializeState: schema іде першим і дорівнює CURRENT_SCHEMA; круговий обхід стабільний', () => {
  const s = migrateState(JSON.parse(v1Raw()))!;
  const text = serializeState(s);
  assert.ok(text.startsWith(SCHEMA_PREFIX));
  assert.equal(JSON.parse(text).schema, CURRENT_SCHEMA);
  assert.deepEqual(migrateState(JSON.parse(text)), s);
});

test('знімок v1: робиться один раз перед першим записом у v2 і не перезаписується', () => {
  const raw = v1Raw();
  const st = memStorage({ [STORAGE_KEY]: raw });
  const state = loadState(st)!;
  assert.equal(saveState(st, state), true);
  assert.equal(st.store.get(SNAPSHOT_KEY), raw);
  assert.ok(st.store.get(STORAGE_KEY)!.startsWith(SCHEMA_PREFIX));
  state.cvs[0]!.name = 'Змінено';
  assert.equal(saveState(st, state), true);
  assert.equal(st.store.get(SNAPSHOT_KEY), raw);
});

test('знімок v1: не створюється для чистої установки', () => {
  const st = memStorage();
  assert.equal(saveState(st, { cvs: [blankCv()], ui: 'pl', currentId: null }), true);
  assert.equal(st.store.has(SNAPSHOT_KEY), false);
});

test('знімок v1: брак місця для знімка не заважає збереженню CV', () => {
  const raw = v1Raw();
  const st = memStorage({ [STORAGE_KEY]: raw });
  const limited = {
    getItem: st.getItem,
    setItem: (k: string, v: string) => {
      if (k === SNAPSHOT_KEY) throw new Error('QuotaExceeded');
      st.setItem(k, v);
    },
  };
  assert.equal(saveState(limited, loadState(st)!), true);
  assert.ok(st.store.get(STORAGE_KEY)!.startsWith(SCHEMA_PREFIX));
  assert.equal(st.store.has(SNAPSHOT_KEY), false);
});

test('normalizeExtras: відкидає сміття, зберігає коректні блоки', () => {
  assert.deepEqual(normalizeExtras(null), {});
  assert.deepEqual(normalizeExtras('x'), {});
  const e = normalizeExtras({
    driver: { categories: ['C', 5], code95: true, routes: ['PL', 'DE', 'UE'] },
    qr: { enabled: 'tak', url: 'https://example.com' },
    tech: 7,
  });
  assert.deepEqual(e.driver?.categories, ['C']);
  assert.equal(e.driver?.code95, true);
  assert.deepEqual(e.driver?.routes, ['PL', 'UE']);
  assert.equal(e.qr?.enabled, false);
  assert.equal(e.qr?.url, 'https://example.com');
  assert.equal(e.tech, undefined);
});

test('normalizeCv: зберігає photoShape і extras, виправляє невірну форму фото', () => {
  const cv = normalizeCv({ data: { basics: { photoShape: 'rounded' }, extras: { qr: { enabled: true, url: 'u', label: 'l' } } }, autoFit: true })!;
  assert.equal(cv.data.basics.photoShape, 'rounded');
  assert.equal(cv.data.extras.qr?.enabled, true);
  assert.equal(cv.autoFit, true);
  assert.equal(normalizeCv({ data: { basics: { photoShape: 'star' } } })!.data.basics.photoShape, 'circle');
});

test('blankCv: мова документа за замовчуванням pl', () => {
  assert.equal(blankCv().lang, 'pl');
});

test('шаблони: безкоштовні рівно classic, minimal, ats, industrial; решта PRO', async () => {
  const { TEMPLATES, TEMPLATE_META, FREE_TEMPLATES, templateTier } = await import('../src/domain/templates.ts');
  assert.deepEqual([...FREE_TEMPLATES].sort(), ['ats', 'classic', 'industrial', 'minimal']);
  for (const k of TEMPLATES) assert.ok(TEMPLATE_META[k].tier === 'free' || TEMPLATE_META[k].tier === 'pro', k);
  assert.equal(TEMPLATES.filter((k) => templateTier(k) === 'pro').length, 10);
  assert.equal(templateTier('nieznany' as never), 'pro');
});
