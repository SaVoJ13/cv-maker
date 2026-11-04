// Повільні тести QR: растеризація вузлів PDF і справжня розкладка pdfmake (npm run test:slow)
import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { sampleCv } from '../src/domain/cvOps.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { qrGeometry } from '../src/domain/qrLayout.ts';
import { qrView } from '../src/domain/qrView.ts';
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

