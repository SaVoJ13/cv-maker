import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleCv } from '../src/domain/cvOps.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { keepHeadingWithContent } from '../src/domain/pdf.ts';
import { PNG, allText, layoutPages, maxBottomGap, orphanHeadings } from './pdfLayout.ts';
import type { Cv, TemplateId } from '../src/domain/types.ts';

/**
 * Розриви сторінок у PDF: заголовок розділу не лишається сам унизу сторінки; великий перший елемент
 * розділу (досвід із 12 пунктами, величезний підсумок) не лишає порожнини понад 40% сторінки і не губить тексту.
 */

const word = (i: number): string => `w${String(i).padStart(5, '0')}`;

/** CV з кількома розділами; `shift` слів у підсумку зсувають усі наступні заголовки відносно кінця сторінки. */
function shifted(tpl: TemplateId, shift: number): Cv {
  const cv = sampleCv();
  (cv as { tpl: string }).tpl = tpl;
  cv.lang = 'pl';
  const d = cv.data;
  d.basics.photo = PNG;
  d.summary = Array.from({ length: shift + 1 }, (_, i) => word(i)).join(' ');
  d.experience = Array.from({ length: 3 }, (_, i) => ({
    id: `e${i}`, role: `Stanowisko ${i + 1}`, company: `Firma ${i + 1}`, city: 'Łódź', from: '01.2019', to: '12.2020', current: false,
    bullets: Array.from({ length: 4 }, (_, j) => `Zadanie ${j + 1}: opis obowiązku wykonywanego w tej firmie przez dłuższy czas`).join('\n'),
  }));
  d.education = [{ id: 's1', school: 'Politechnika', degree: 'Inżynier', field: 'Mechanika', from: '2012', to: '2016' }];
  d.courses = 'Kurs spawania\nKurs BHP';
  d.skillsHard = 'Spawanie, CNC, AutoCAD';
  d.skillsSoft = 'Komunikacja, punktualność';
  d.interests = 'Rower, szachy';
  d.extras = {
    driver: { categories: ['B', 'C'], code95: true, tachograph: false, adr: false, udt: false, fleet: 'Ciągnik', routes: ['PL'] },
    tech: { sep: 'E do 1 kV', welding: ['MIG'], cnc: '', drawings: true, bhp: true, certs: ['Operator suwnic'] },
  };
  return cv;
}

/** Досвід, де перший елемент має 12 пунктів по ~2 рядки, і до нього зсув `shift` слів підсумку. */
function bigFirst(tpl: TemplateId, shift: number): Cv {
  const cv = shifted(tpl, shift);
  cv.data.experience = [
    {
      id: 'big', role: 'Pierwsze stanowisko', company: 'Firma', city: 'Łódź', from: '01.2020', to: '', current: true,
      bullets: Array.from({ length: 12 }, (_, j) => `PUNKT${j}: ` + 'dłuższy opis obowiązku wykonywanego w tej firmie '.repeat(3)).join('\n'),
    },
  ];
  return cv;
}

test('правило keepHeadingWithContent: заголовок без першого елемента на сторінці переноситься, з ним лишається', () => {
  assert.equal(keepHeadingWithContent({ headlineLevel: 1 }, [{}, {}]), true);
  assert.equal(keepHeadingWithContent({ headlineLevel: 1 }, [{}, { headlineLevel: 2 }]), false);
  assert.equal(keepHeadingWithContent({ headlineLevel: 2 }, []), false);
  assert.equal(keepHeadingWithContent({}, []), false);
});

test('заголовок розділу не лишається сам унизу сторінки: усі позиції межі сторінки, шаблони з різними заголовками', async () => {
  let layouts = 0;
  for (const tpl of ['classic', 'minimal', 'trades', 'panel'] as const) {
    for (let shift = 0; shift <= 800; shift += 28) {
      const pages = await layoutPages(shifted(tpl, shift));
      assert.deepEqual(orphanHeadings(pages, tpl, 'pl'), [], `${tpl}, зсув ${shift}`);
      layouts += 1;
    }
  }
  assert.ok(layouts > 100);
});

test('великий перший елемент (досвід із 12 пунктами) не створює порожнини понад 40% сторінки і не губить пунктів: усі 15 шаблонів', async () => {
  for (const tpl of TEMPLATES) {
    let worst = 0;
    for (let shift = 0; shift <= 330; shift += 55) {
      const pages = await layoutPages(bigFirst(tpl, shift));
      worst = Math.max(worst, maxBottomGap(pages));
      const text = allText(pages);
      for (let j = 0; j < 12; j++) assert.ok(text.includes(`PUNKT${j}:`), `${tpl}, зсув ${shift}: пункт ${j} загублено`);
      assert.deepEqual(orphanHeadings(pages, tpl, 'pl'), [], `${tpl}, зсув ${shift}`);
    }
    assert.ok(worst <= 0.4, `${tpl}: порожнина ${Math.round(worst * 100)}% сторінки`);
  }
});

test('неподільний блок вищий за сторінку не обрізається: підсумок на 2200 слів займає кілька сторінок і не губить тексту', async () => {
  for (const tpl of TEMPLATES) {
    const pages = await layoutPages(shifted(tpl, 2200));
    assert.ok(pages.length >= 3, `${tpl}: сторінок ${pages.length}`);
    const text = allText(pages);
    for (const i of [0, 500, 1100, 1700, 2200]) assert.ok(text.includes(word(i)), `${tpl}: слово ${i} загублено`);
    assert.deepEqual(orphanHeadings(pages, tpl, 'pl'), [], tpl);
  }
});
