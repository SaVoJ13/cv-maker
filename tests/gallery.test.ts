import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { blankCv, sampleCv, showsPhoto } from '../src/domain/cvOps.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import type { Cv, DocLang, TemplateId } from '../src/domain/types.ts';

/**
 * Перевірка всієї галереї: PDF для кожного шаблону × PL/EN × (порожнє CV, приклад, довге CV на 2+ сторінки)
 * справді проходить розкладку pdfmake (Node), а заголовок розділу ніколи не лишається сам унизу сторінки.
 */
const require = createRequire(import.meta.url);
const pdfMake = require('pdfmake/build/pdfmake.js') as {
  vfs: unknown;
  createPdf: (doc: unknown) => { getBuffer: (cb: (b: Uint8Array) => void) => void };
};
const fonts = require('pdfmake/build/vfs_fonts.js') as { pdfMake?: { vfs: unknown } };
pdfMake.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : fonts;

// 1×1 PNG: достатньо, щоб шаблони з фото намалювали місце під зображення
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

type Kind = 'empty' | 'sample' | 'long';

function makeCv(tpl: TemplateId, lang: DocLang, kind: Kind): Cv {
  const cv = kind === 'empty' ? blankCv(lang) : sampleCv();
  (cv as { tpl: string }).tpl = tpl;
  cv.lang = lang;
  if (kind === 'empty') return cv;
  cv.data.basics.photo = PNG;
  if (kind === 'long') {
    const d = cv.data;
    d.summary = 'Doświadczony specjalista, który ceni terminowość i dokładność. '.repeat(6).trim();
    d.experience = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      role: `Stanowisko numer ${i + 1}`,
      company: `Firma ${i + 1} Sp. z o.o.`,
      city: 'Łódź',
      from: `0${(i % 9) + 1}.201${i}`,
      to: `0${(i % 9) + 1}.201${i + 1}`,
      current: false,
      bullets: Array.from({ length: 5 }, (_, j) => `Obowiązek ${j + 1}: opis zadania wykonywanego w tej firmie, dość długi, żeby zająć więcej niż jeden wiersz`).join('\n'),
    }));
    d.education = Array.from({ length: 3 }, (_, i) => ({ id: `s${i}`, school: `Szkoła ${i + 1}`, degree: 'Inżynier', field: 'Mechanika', from: `200${i}`, to: `200${i + 4}` }));
    d.courses = Array.from({ length: 8 }, (_, i) => `Kurs lub projekt numer ${i + 1}`).join('\n');
    d.extras = {
      driver: { categories: ['B', 'C', 'CE'], code95: true, tachograph: true, adr: true, udt: true, fleet: 'Ciągnik siodłowy z naczepą', routes: ['PL', 'UE'] },
      tech: { sep: 'E do 1 kV', welding: ['MIG', 'TIG'], cnc: 'Fanuc', drawings: true, bhp: true, certs: ['Operator suwnic', 'Pierwsza pomoc'] },
    };
  }
  return cv;
}

interface ProbeNode {
  headlineLevel?: number;
  pageNumbers?: number[];
  startPosition?: { pageNumber: number };
}

/** Прогоняє документ крізь реальну розкладку pdfmake; повертає кількість сторінок і сторінки заголовків. */
function layout(cv: Cv): Promise<{ pages: number; headingPages: number[][] }> {
  const photo = showsPhoto(cv) ? PNG : undefined;
  const doc = buildPdfDocument(cv, photo) as unknown as Record<string, unknown>;
  const headingPages: number[][] = [];
  let pages = 1;
  doc.pageBreakBefore = (node: ProbeNode): boolean => {
    const n = node.pageNumbers?.length ? node.pageNumbers : node.startPosition ? [node.startPosition.pageNumber] : [];
    for (const p of n) pages = Math.max(pages, p);
    if (node.headlineLevel === 1) headingPages.push(n);
    return false;
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 20_000);
    try {
      pdfMake.createPdf(doc).getBuffer((buf) => {
        clearTimeout(timer);
        assert.ok(buf.length > 1000);
        resolve({ pages, headingPages });
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

test('галерея: у ній 15 шаблонів, і кожен має заголовки розділів у неподільних блоках', () => {
  assert.equal(TEMPLATES.length, 15);
  for (const tpl of TEMPLATES) {
    for (const lang of ['pl', 'en'] as const) {
      const doc = buildPdfDocument(makeCv(tpl, lang, 'long'), PNG);
      const blocks = (doc.content as Array<{ headlineLevel?: number; unbreakable?: boolean; stack?: unknown[] }>).filter((n) => n.headlineLevel === 1);
      assert.ok(blocks.length >= 3, `${tpl}/${lang}: заголовків ${blocks.length}`);
      for (const b of blocks) {
        assert.equal(b.unbreakable, true, `${tpl}/${lang}`);
        assert.ok((b.stack?.length ?? 0) >= 2, `${tpl}/${lang}: заголовок разом з першим елементом`);
      }
    }
  }
});

test('галерея: PDF для всіх шаблонів × PL/EN × (порожнє, приклад, довге) будується без помилок; довге CV займає 2+ сторінки; заголовки не розриваються', async () => {
  let checked = 0;
  for (const tpl of TEMPLATES) {
    for (const lang of ['pl', 'en'] as const) {
      for (const kind of ['empty', 'sample', 'long'] as const) {
        const cv = makeCv(tpl, lang, kind);
        const r = await layout(cv);
        const id = `${tpl}/${lang}/${kind}`;
        if (kind !== 'empty') assert.ok(r.headingPages.length >= 3, `${id}: проба не бачила заголовків (${r.headingPages.length})`);
        if (kind === 'long') assert.ok(r.pages >= 2, `${id}: сторінок ${r.pages}`);
        for (const p of r.headingPages) assert.equal(new Set(p).size, 1, `${id}: блок заголовка розірвано між сторінками ${p.join(',')}`);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 15 * 2 * 3);
});
