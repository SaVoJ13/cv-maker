import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import jsQR from 'jsqr';
import { blankCv, sampleCv } from '../src/domain/cvOps.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { qrMatrix, QR_MAX_VERSION } from '../src/domain/qr.ts';
import { QR_MIN_MODULE_PT, QR_MIN_SIDE_PT, QR_OVERLAP_PT, darkRuns, qrGeometry } from '../src/domain/qrLayout.ts';
import { qrView } from '../src/domain/qrView.ts';
import { Paper } from '../src/components/Paper.tsx';
import { PNG, layoutPages, allText } from './pdfLayout.ts';
import type { Cv, DocLang, TemplateId } from '../src/domain/types.ts';

const URL_LI = 'https://www.linkedin.com/in/jan-kowalski-123456';

function cvWithQr(tpl: TemplateId = 'classic', lang: DocLang = 'pl', url = URL_LI, label = 'LinkedIn'): Cv {
  const cv = sampleCv();
  (cv as { tpl: string }).tpl = tpl;
  cv.lang = lang;
  cv.data.basics.photo = PNG;
  cv.data.extras.qr = { enabled: true, url, label };
  return cv;
}

interface PdfNode {
  [k: string]: unknown;
}

/** Рекурсивно знаходить усі вузли з даною властивістю. */
function findAll(n: unknown, key: string, out: PdfNode[] = []): PdfNode[] {
  if (Array.isArray(n)) n.forEach((x) => findAll(x, key, out));
  else if (n && typeof n === 'object') {
    const o = n as PdfNode;
    if (o[key] !== undefined) out.push(o);
    Object.values(o).forEach((v) => findAll(v, key, out));
  }
  return out;
}

function qrColumns(cv: Cv): PdfNode | undefined {
  const content = buildPdfDocument(cv, PNG).content as PdfNode[];
  return content.find((n) => Array.isArray(n.columns) && JSON.stringify(n.columns).includes('"canvas"'));
}

test('розмір QR залежить від версії: сторона ≥ 24 мм, модуль ≥ 1.7 пт, вищі версії більші (версії 1–7)', () => {
  let prev = 0;
  for (let v = 1; v <= QR_MAX_VERSION; v++) {
    const size = 21 + 4 * (v - 1);
    const g = qrGeometry(size);
    assert.ok(g.side >= QR_MIN_SIDE_PT - 1e-9, `v${v}: сторона ${g.side}`);
    assert.ok(g.module >= QR_MIN_MODULE_PT - 1e-9, `v${v}: модуль ${g.module}`);
    assert.ok(Math.abs(g.module * size - g.side) < 1e-9);
    assert.ok(Math.abs(g.total - (g.side + 8 * g.module)) < 1e-9, 'тиха зона 4 модулі з кожного боку');
    assert.ok(g.side >= prev - 1e-9, `v${v}: не менша за попередню`);
    prev = g.side;
  }
  assert.ok(Math.abs(QR_MIN_SIDE_PT - 68.03) < 0.01);
  assert.ok(qrGeometry(21).side === QR_MIN_SIDE_PT, 'версія 1 друкується мінімального розміру 24 мм');
  assert.ok(qrGeometry(45).side > QR_MIN_SIDE_PT, 'версія 7 більша за мінімум');
});

test('серії темних модулів: сума довжин = кількість темних модулів, серії максимальні й відновлюють матрицю', () => {
  for (const u of [URL_LI, 'https://a.io', 'https://example.com/' + 'a'.repeat(98)]) {
    const m = qrMatrix(u);
    const dark = m.modules.flat().filter(Boolean).length;
    const runs = darkRuns(m);
    assert.equal(runs.reduce((s, r) => s + r.len, 0), dark);
    assert.ok(runs.length < dark, 'серії справді об’єднують модулі');
    const back = m.modules.map((row) => row.map(() => false));
    runs.forEach((r, i) => {
      for (let c = r.col; c < r.col + r.len; c++) back[r.row][c] = true;
      const next = runs[i + 1];
      if (next && next.row === r.row) assert.ok(next.col > r.col + r.len, 'дві серії в рядку не торкаються');
    });
    assert.deepEqual(back, m.modules);
  }
});

test('PDF: QR малюється вектором із об’єднаних серій; сума довжин = кількість темних модулів; білий фон і тиха зона', () => {
  const cv = cvWithQr();
  const qr = qrView(cv)!;
  const g = qrGeometry(qr.matrix.size);
  const node = qrColumns(cv)!;
  assert.ok(node);
  const rects = findAll(node, 'canvas').flatMap((n) => n.canvas as PdfNode[]);
  const [bg, ...dark] = rects;
  assert.equal(bg.color, '#FFFFFF');
  assert.equal(bg.w, g.total);
  const totalLen = dark.reduce((s, r) => s + (r.w as number) / g.module, 0);
  assert.ok(Math.abs(totalLen - qr.matrix.modules.flat().filter(Boolean).length) < 1e-6);
  assert.equal(dark.length, darkRuns(qr.matrix).length);
  assert.ok(dark.every((r) => r.color === '#000000' && Math.abs((r.h as number) - (g.module + QR_OVERLAP_PT)) < 1e-9));
  // нічого з темного не виходить за білу тиху зону
  assert.ok(dark.every((r) => (r.x as number) >= g.quiet - 1e-9 && (r.x as number) + (r.w as number) <= g.total - g.quiet + 1e-9));
  assert.equal(node.unbreakable, true);
});

test('PDF: QR, намальований у PDF-геометрії, розкодовується назад у той самий URL (растеризація вузлів)', () => {
  for (const url of [URL_LI, 'https://a.io', 'https://example.com/' + 'q'.repeat(98)]) {
    const cv = cvWithQr('classic', 'pl', url);
    const g = qrGeometry(qrView(cv)!.matrix.size);
    const rects = findAll(qrColumns(cv)!, 'canvas').flatMap((n) => n.canvas as PdfNode[]);
    const scale = 8;
    const side = Math.ceil(g.total * scale);
    const data = new Uint8ClampedArray(side * side * 4).fill(255);
    for (const r of rects.slice(1)) {
      const x0 = Math.round((r.x as number) * scale);
      const y0 = Math.round((r.y as number) * scale);
      const x1 = Math.round(((r.x as number) + (r.w as number)) * scale);
      const y1 = Math.round(((r.y as number) + (r.h as number)) * scale);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * side + x) * 4, (y * side + x) * 4 + 3);
    }
    assert.equal(jsQR(data, side, side)?.data, url);
  }
});

test('PDF: URL друкується текстом поряд із QR як клікабельне посилання (link), підпис зверху', () => {
  const cv = cvWithQr();
  const node = qrColumns(cv)!;
  const links = findAll(node, 'link');
  assert.equal(links.length, 1);
  assert.equal(links[0].link, URL_LI);
  assert.equal(links[0].text, 'www.linkedin.com/in/jan-kowalski-123456');
  const texts = findAll(node, 'text').map((n) => n.text);
  assert.ok(texts.includes('LinkedIn'));
  // без підпису — лише посилання
  const noLabel = qrColumns(cvWithQr('classic', 'pl', URL_LI, ''))!;
  assert.deepEqual(findAll(noLabel, 'text').map((n) => n.text), ['www.linkedin.com/in/jan-kowalski-123456']);
});

test('PDF: вимкнений, порожній, хибний або http-QR нічого не друкує; нічого не підставляється', () => {
  const off = cvWithQr();
  off.data.extras.qr!.enabled = false;
  const empty = cvWithQr('classic', 'pl', '');
  const http = cvWithQr('classic', 'pl', 'http://example.com');
  const spaces = cvWithQr('classic', 'pl', 'https://exa mple.com');
  const none = blankCv();
  for (const cv of [off, empty, http, spaces, none]) {
    assert.equal(qrColumns(cv), undefined);
    assert.equal(findAll(buildPdfDocument(cv, PNG).content, 'link').length, 0);
    assert.equal(qrView(cv), null);
  }
});

test('QR в кінці основної колонки, однаково в усіх 15 шаблонах × PL/EN; реальна розкладка: текст посилання є, нічого не обрізано', async () => {
  for (const tpl of TEMPLATES) {
    for (const lang of ['pl', 'en'] as const) {
      const cv = cvWithQr(tpl, lang);
      const content = buildPdfDocument(cv, PNG).content as PdfNode[];
      const idx = content.findIndex((n) => Array.isArray(n.columns) && JSON.stringify(n.columns).includes('"canvas"'));
      assert.equal(idx, content.length - 3, `${tpl}/${lang}: QR перед лінією й застереженням RODO`);
      // справжню розкладку (повільну) проганяємо для PL у всіх шаблонах і для EN у трьох
      if (lang === 'en' && !['classic', 'panel', 'elegant'].includes(tpl)) continue;
      const pages = await layoutPages(cv);
      assert.match(allText(pages), /www\.linkedin\.com\/in\/jan-kowalski-123456/, `${tpl}/${lang}`);
    }
  }
});

test('прев’ю: той самий QR (серії), посилання з rel="noopener noreferrer" і target="_blank", підпис; без QR розмітки немає', () => {
  const cv = cvWithQr('student', 'pl');
  const html = renderToStaticMarkup(createElement(Paper, { cv }));
  const qr = qrView(cv)!;
  assert.match(html, /<a href="https:\/\/www\.linkedin\.com\/in\/jan-kowalski-123456" target="_blank" rel="noopener noreferrer">www\.linkedin\.com\/in\/jan-kowalski-123456<\/a>/);
  assert.match(html, /<b>LinkedIn<\/b>/);
  const svg = html.slice(html.indexOf('<svg class="p-qrsvg"'), html.indexOf('</svg>', html.indexOf('<svg class="p-qrsvg"')));
  assert.equal((svg.match(/<rect /g) ?? []).length, 1 + darkRuns(qr.matrix).length);
  // розмітка QR стоїть перед застереженням RODO
  assert.ok(html.indexOf('p-qr"') < html.indexOf('p-rodo'));
  for (const bad of ['', 'http://x.com', 'https://a b.com']) {
    const off = cvWithQr('student', 'pl', bad);
    assert.doesNotMatch(renderToStaticMarkup(createElement(Paper, { cv: off })), /p-qr"/);
  }
  assert.doesNotMatch(renderToStaticMarkup(createElement(Paper, { cv: blankCv() })), /p-qr"/);
});
