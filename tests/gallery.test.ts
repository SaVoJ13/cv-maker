import test from 'node:test';
import assert from 'node:assert/strict';
import { blankCv, sampleCv } from '../src/domain/cvOps.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { PNG, layoutPages, orphanHeadings } from './pdfLayout.ts';
import type { Cv, DocLang, TemplateId } from '../src/domain/types.ts';

/**
 * Перевірка всієї галереї: PDF для кожного шаблону × PL/EN × (порожнє CV, приклад, довге CV на 2+ сторінки)
 * проходить справжню розкладку pdfmake (Node), а заголовок розділу ніколи не лишається сам унизу сторінки.
 */

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

test('галерея: у ній 15 шаблонів; кожен розділ склеює заголовок із першим рядком (неподільна група) або позначає заголовок і абзац для pageBreakBefore', () => {
  assert.equal(TEMPLATES.length, 15);
  for (const tpl of TEMPLATES) {
    for (const lang of ['pl', 'en'] as const) {
      const doc = buildPdfDocument(makeCv(tpl, lang, 'long'), PNG);
      const nodes = doc.content as Array<{ headlineLevel?: number; unbreakable?: boolean; stack?: unknown[] }>;
      // розділ = або склеєна неподільна група (заголовок + перший рядок), або заголовок (1) і за ним абзац (2)
      const glued = nodes.filter((n) => n.unbreakable === true && n.headlineLevel === undefined && (n.stack?.length ?? 0) >= 2).length;
      const heads = nodes.map((n, i) => (n.headlineLevel === 1 ? i : -1)).filter((i) => i >= 0);
      for (const i of heads) assert.equal(nodes[i + 1]?.headlineLevel, 2, `${tpl}/${lang}: за заголовком не йде абзац з позначкою 2`);
      assert.ok(glued + heads.length >= 3, `${tpl}/${lang}: розділів ${glued + heads.length}`);
      assert.equal(typeof doc.pageBreakBefore, 'function');
    }
  }
});

test('галерея: PDF для всіх шаблонів × PL/EN × (порожнє, приклад, довге) будується без помилок; довге CV займає 2+ сторінки; заголовки не лишаються самі', async () => {
  let checked = 0;
  for (const tpl of TEMPLATES) {
    for (const lang of ['pl', 'en'] as const) {
      for (const kind of ['empty', 'sample', 'long'] as const) {
        const pages = await layoutPages(makeCv(tpl, lang, kind));
        const id = `${tpl}/${lang}/${kind}`;
        if (kind === 'long') assert.ok(pages.length >= 2, `${id}: сторінок ${pages.length}`);
        if (kind !== 'empty') assert.ok(pages[0].lines.length > 5, `${id}: на першій сторінці немає тексту`);
        assert.deepEqual(orphanHeadings(pages, tpl, lang), [], id);
        checked += 1;
      }
    }
  }
  assert.equal(checked, 15 * 2 * 3);
});
