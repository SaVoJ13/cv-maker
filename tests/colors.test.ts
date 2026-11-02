import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCENTS, ACCENT_IDS } from '../src/domain/constants.ts';
import { contrastRatio, deltaE, luminance, tint, toLab } from '../src/domain/color.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { blankCv, normalizeCv } from '../src/domain/cvOps.ts';

/** Мінімальний контраст заголовків на білому (WCAG AA для тексту). */
const MIN_CONTRAST = 4.5;
/** Мінімальна різниця між двома кольорами палітри в CIELAB, щоб вони не дублювали один одного. */
const MIN_DELTA_E = 20;

test('палітра: 12 кольорів, усі у форматі #RRGGBB', () => {
  assert.equal(ACCENT_IDS.length, 12);
  for (const id of ACCENT_IDS) assert.match(ACCENTS[id], /^#[0-9A-F]{6}$/, id);
});

test('кожен колір має контраст на білому не менше 4.5:1', () => {
  for (const id of ACCENT_IDS) {
    const c = contrastRatio(ACCENTS[id], '#FFFFFF');
    assert.ok(c >= MIN_CONTRAST, `${id} ${ACCENTS[id]}: ${c.toFixed(2)}:1`);
  }
});

test('нові кольори мають очікуваний контраст (brown ≈ 8.6, rose ≈ 6.8)', () => {
  assert.ok(Math.abs(contrastRatio(ACCENTS.brown, '#FFFFFF') - 8.63) < 0.05);
  assert.ok(Math.abs(contrastRatio(ACCENTS.rose, '#FFFFFF') - 6.83) < 0.05);
});

test('жодні два кольори палітри не ближчі за ΔE 20 у CIELAB (нові кольори теж не дублюють наявні)', () => {
  for (let i = 0; i < ACCENT_IDS.length; i++)
    for (let j = i + 1; j < ACCENT_IDS.length; j++) {
      const a = ACCENT_IDS[i];
      const b = ACCENT_IDS[j];
      const d = deltaE(ACCENTS[a], ACCENTS[b]);
      assert.ok(d >= MIN_DELTA_E, `${a} і ${b} надто схожі: ΔE ${d.toFixed(1)}`);
    }
});

test('допоміжні функції кольору: еталонні значення', () => {
  assert.equal(luminance('#FFFFFF').toFixed(3), '1.000');
  assert.equal(luminance('#000000'), 0);
  assert.equal(contrastRatio('#000000', '#FFFFFF').toFixed(1), '21.0');
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1);
  const white = toLab('#FFFFFF');
  assert.ok(Math.abs(white[0] - 100) < 0.1 && Math.abs(white[1]) < 0.1 && Math.abs(white[2]) < 0.1);
  assert.equal(deltaE('#123456', '#123456'), 0);
  assert.ok(deltaE('#000000', '#FFFFFF') > 99);
});

test('світлий фон бічної панелі від кожного акценту лишається світлим', () => {
  for (const id of ACCENT_IDS) assert.ok(luminance(tint(ACCENTS[id])) > 0.8, id);
});

test('назви кольорів є в PL/UA/EN для всіх 12', () => {
  for (const lang of ['pl', 'uk', 'en'] as const)
    for (const id of ACCENT_IDS) assert.ok((MESSAGES[lang] as Record<string, string>)[`acc_${id}`], `${lang}/acc_${id}`);
});

test('старі CV зі старими кольорами лишаються, невідомий колір повертається до navy', () => {
  for (const id of ['navy', 'azure', 'graphite', 'emerald', 'burgundy', 'crimson', 'rose', 'brown'] as const)
    assert.equal(normalizeCv({ ...blankCv(), accent: id })?.accent, id);
  assert.equal(normalizeCv({ ...blankCv(), accent: 'pink' as never })?.accent, 'navy');
});
