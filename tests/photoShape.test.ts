import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PDF_PHOTO_MAX_PT,
  PDF_PHOTO_SCALE,
  PHOTO_SHAPE_RADIUS,
  SIZE_MAX,
  SIZE_MIN,
  pdfPhotoPx,
  shapeRadiusCss,
  shapeRadiusPx,
} from '../src/domain/photo.ts';
import { blankCv, normalizeCv } from '../src/domain/cvOps.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import type { PhotoShape } from '../src/domain/types.ts';

const SHAPES: PhotoShape[] = ['circle', 'rounded', 'square'];

test('радіус форм: circle = половина сторони, rounded = 18%, square = 0', () => {
  assert.deepEqual(PHOTO_SHAPE_RADIUS, { circle: 0.5, rounded: 0.18, square: 0 });
  assert.equal(shapeRadiusPx('circle', 480), 240);
  assert.equal(shapeRadiusPx('rounded', 100), 18);
  assert.equal(shapeRadiusPx('square', 480), 0);
});

test('CSS-радіус для прев’ю збігається з таблицею, невідома форма — коло', () => {
  assert.equal(shapeRadiusCss('circle'), '50%');
  assert.equal(shapeRadiusCss('rounded'), '18%');
  assert.equal(shapeRadiusCss('square'), '0%');
  assert.equal(shapeRadiusCss('star' as PhotoShape), '50%');
  assert.equal(shapeRadiusPx('star' as PhotoShape, 100), 50);
});

test('PNG для PDF: запас роздільності не менше 2× від розміру на сторінці для всіх розмірів рамки', () => {
  assert.ok(PDF_PHOTO_SCALE >= 2);
  for (let size = SIZE_MIN; size <= SIZE_MAX; size += 5) {
    const px = pdfPhotoPx(size);
    const maxPt = PDF_PHOTO_MAX_PT * (size / 100);
    assert.ok(px >= 2 * maxPt, `size ${size}: ${px}px < 2× ${maxPt}pt`);
    assert.ok(px >= 480 && px <= 1024, `size ${size}: ${px}px`);
  }
  assert.equal(pdfPhotoPx(Number.NaN), pdfPhotoPx(100));
  assert.equal(pdfPhotoPx(9999), pdfPhotoPx(SIZE_MAX));
});

test('PDF отримує готовий PNG однаково для всіх форм; форма не змінює розміри блоку фото', () => {
  const png = 'data:image/png;base64,AAAA';
  const sizes = SHAPES.map((photoShape) => {
    const cv = blankCv('pl', '', { tpl: 'nordic' });
    cv.data.basics.photo = 'data:image/jpeg;base64,AAAA';
    cv.data.basics.photoShape = photoShape;
    return JSON.stringify(buildPdfDocument(cv, png).content);
  });
  assert.equal(sizes[0], sizes[1]);
  assert.equal(sizes[1], sizes[2]);
});

test('normalizeCv: збережена форма фото лишається, сміття повертається до circle', () => {
  for (const s of SHAPES) {
    const cv = blankCv();
    cv.data.basics.photoShape = s;
    assert.equal(normalizeCv(cv)?.data.basics.photoShape, s);
  }
  const bad = blankCv();
  (bad.data.basics as { photoShape: string }).photoShape = 'hexagon';
  assert.equal(normalizeCv(bad)?.data.basics.photoShape, 'circle');
});

test('стилі прев’ю беруть радіус зі змінної --pr (аркуш і редактор)', () => {
  const paper = readFileSync(new URL('../src/styles/paper.css', import.meta.url), 'utf8');
  const editor = readFileSync(new URL('../src/styles/editor.css', import.meta.url), 'utf8');
  assert.match(paper, /\.paper \.p-photo \{[^}]*border-radius: var\(--pr, 50%\)/s);
  assert.match(editor, /\.photobox \.pthumb \{[^}]*border-radius: var\(--pr, 50%\)/s);
});
