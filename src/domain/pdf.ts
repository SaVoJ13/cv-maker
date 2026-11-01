import type { Cv, TemplateId } from './types';
import { ACCENTS, DENSITY } from './constants';
import { SIDEBAR } from './templates';
import { tint } from './color';
import { DOC } from './docText';
import {
  dateRange,
  documentClause,
  extraDetails,
  filledEducation,
  filledExperience,
  filledLanguages,
  levelLabel,
  lines,
  list,
  mainHas,
  showsPhoto,
  sideBlocks,
} from './cvOps';

/**
 * Definicja dokumentu dla pdfmake. Zwracamy zwykły obiekt, żeby warstwa domenowa
 * nie zależała od biblioteki; eksport (src/export/exportPdf.ts) rzutuje go na typ pdfmake.
 * PDF zawiera prawdziwy tekst (nie obraz), więc systemy ATS potrafią go odczytać.
 * Nagłówek, nazwisko i treść są zwykłym tekstem w kolejności czytania; w warstwie tła
 * (`background`) są tylko kolorowe prostokąty i dekoracje oraz zawartość pasków bocznych.
 */
export interface PdfDocDefinition {
  pageSize: 'A4';
  pageMargins: [number, number, number, number];
  content: unknown[];
  defaultStyle: Record<string, unknown>;
  info: Record<string, string>;
  footer: (currentPage: number, pageCount: number) => unknown;
  background?: (currentPage: number) => unknown;
}

const INK = '#1b1f24';
const GREY = '#555555';
const GOLD = '#C9A24B';
const GOLD_LIGHT = '#E8C97A';
const GOLD_LINE = '#B79B5B';
const CREAM = '#F7F2E8';
const NIGHT = '#15181E';
const STEEL = '#2B2F36';
const CREATIVE_SIDE = '#1E2430';
const PAGE_W = 595.28;
const PAGE_H = 841.89;

/** Paski boczne: szerokość, wewnętrzny margines i odstęp od treści głównej */
const SIDE_W: Partial<Record<TemplateId, number>> = { panel: 176, creative: 168, nordic: 176 };
const SIDE_PAD = 18;
const SIDE_GAP = 26;
const OUTER = 34;

type Node = Record<string, unknown>;

export function buildPdfDocument(cv: Cv, photoPng?: string): PdfDocDefinition {
  const L = DOC[cv.lang];
  const d = cv.data;
  const b = d.basics;
  const ac = ACCENTS[cv.accent];
  const k = DENSITY[cv.density];
  const tpl = cv.tpl;
  const side = SIDEBAR[tpl];
  const sideW = SIDE_W[tpl] ?? 0;
  const has = mainHas(tpl);
  const photo = showsPhoto(cv) ? photoPng : undefined;
  const scale = b.photoSize / 100;
  const headD = Math.round(84 * scale);
  /** Średnica w panelu nie może przekroczyć szerokości paska */
  const panelD = Math.min(Math.round(108 * scale), sideW - 2 * SIDE_PAD);

  const margins: [number, number, number, number] =
    side === 'left' ? [sideW + SIDE_GAP, 40, OUTER, 44] : side === 'right' ? [40, 40, sideW + SIDE_GAP, 44] : [40, 40, 40, 44];
  const contentW = PAGE_W - margins[0] - margins[2];
  const content: Node[] = [];

  const contactParts = [b.email, b.phone, b.city, b.link].filter(Boolean);
  const contact = contactParts.join('   •   ');
  const extraRows = extraDetails(b, L).map((r) => `${r.label}: ${r.value}`);
  const extra = extraRows.join('   •   ');

  const rule = (width: number, color: string, margin: number[], w = contentW): Node => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: w, y2: 0, lineWidth: width, lineColor: color }],
    margin,
  });

  const photoNode = (diam: number): Node => ({ width: diam, image: photo, fit: [diam, diam] });

  /** Nagłówek na całą szerokość arkusza (ujemne marginesy równoważą marginesy strony). */
  const bleed = (bg: string, stack: Node[], stripe?: { h: number; color: string }): Node => {
    const cell: Node = photo
      ? { columns: [{ width: '*', stack }, photoNode(headD)], columnGap: 16 }
      : { stack };
    const body: Node[][] = [[cell]];
    if (stripe) body.push([{ text: '', fontSize: 1 }]);
    const half = stripe ? (stripe.h - 1.25) / 2 : 0;
    return {
      table: { widths: ['*'], body },
      margin: [-margins[0], -margins[1], -margins[2], 0],
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => margins[0],
        paddingRight: () => margins[2],
        paddingTop: (i: number) => (i === 0 ? 34 : half),
        paddingBottom: (i: number) => (i === 0 ? 18 : half),
        fillColor: (i: number) => (i === 0 ? bg : stripe?.color ?? bg),
      },
    };
  };

  /* ---------- nagłówek ---------- */
  const stackOf = (name: Node, title: string, titleStyle: Node, contactColor: string, extraColor: string): Node[] => {
    const st: Node[] = [name];
    if (title) st.push({ text: title, margin: [0, 3, 0, 0], ...titleStyle });
    if (contact) st.push({ text: contact, fontSize: 9.5, color: contactColor, margin: [0, 8, 0, 0] });
    if (extra) st.push({ text: extra, fontSize: 8.5, color: extraColor, margin: [0, 4, 0, 0] });
    return st;
  };

  if (tpl === 'modern') {
    const stack = stackOf({ text: b.name, fontSize: 24, bold: true, color: '#ffffff' }, b.title, { fontSize: 12.5, color: '#ffffff' }, '#E9EEF3', '#D5DDE6');
    const cell: Node = photo ? { columns: [{ width: '*', stack }, photoNode(headD)], columnGap: 16 } : { stack };
    content.push({
      table: { widths: ['*'], body: [[cell]] },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: () => 0,
        paddingLeft: () => 18,
        paddingRight: () => 18,
        paddingTop: () => 16,
        paddingBottom: () => 16,
        fillColor: () => ac,
      },
    });
  } else if (tpl === 'executive') {
    content.push(
      bleed(ac, stackOf({ text: b.name, fontSize: 25, bold: true, color: GOLD_LIGHT }, b.title, { fontSize: 12.5, color: '#ffffff' }, '#EEF2F7', '#D5DDE6')),
    );
  } else if (tpl === 'bold') {
    content.push(
      bleed(
        NIGHT,
        stackOf(
          { text: b.name.toUpperCase(), fontSize: 25, bold: true, color: '#ffffff', characterSpacing: 1.2 },
          b.title.toUpperCase(),
          { fontSize: 11.5, color: '#D9DEE5', characterSpacing: 1.2 },
          '#C9CED6',
          '#B4BAC3',
        ),
        { h: 6, color: ac },
      ),
    );
  } else if (tpl === 'industrial') {
    content.push(
      bleed(
        STEEL,
        stackOf(
          { text: b.name, fontSize: 26, bold: true, color: '#ffffff' },
          b.title.toUpperCase(),
          { fontSize: 11.5, color: '#E3E7EC', characterSpacing: 1.2 },
          '#D3D8DF',
          '#BFC6CF',
        ),
        { h: 9, color: ac },
      ),
    );
  } else if (tpl === 'elegant') {
    const mid = contentW / 2;
    content.push({ text: b.name.toUpperCase(), fontSize: 22, characterSpacing: 3.5, alignment: 'center', color: INK });
    if (b.title) content.push({ text: b.title, fontSize: 12.5, italics: true, color: ac, alignment: 'center', margin: [0, 4, 0, 0] });
    content.push({
      canvas: [
        { type: 'line', x1: mid - 65, y1: 5, x2: mid + 65, y2: 5, lineWidth: 0.8, lineColor: GOLD_LINE },
        {
          type: 'polyline',
          closePath: true,
          lineWidth: 0.5,
          lineColor: GOLD_LINE,
          color: GOLD_LINE,
          points: [
            { x: mid, y: 1.5 },
            { x: mid + 3.5, y: 5 },
            { x: mid, y: 8.5 },
            { x: mid - 3.5, y: 5 },
          ],
        },
      ],
      margin: [0, 9, 0, 0],
    });
    if (contact) content.push({ text: contact, fontSize: 9.5, color: '#444444', alignment: 'center', margin: [0, 8, 0, 0] });
    if (extra) content.push({ text: extra, fontSize: 8.5, color: GREY, alignment: 'center', margin: [0, 3, 0, 0] });
  } else if (tpl === 'technical') {
    const right: Node[] = contactParts.map((c) => ({ text: c, fontSize: 9.5, color: '#444444', alignment: 'right' }));
    for (const r of extraRows) right.push({ text: r, fontSize: 8.5, color: GREY, alignment: 'right' });
    const left: Node[] = [{ text: b.name, fontSize: 25, bold: true, color: INK }];
    if (b.title) left.push({ text: b.title, fontSize: 12.5, color: ac, margin: [0, 3, 0, 0] });
    content.push({ columns: [{ width: '*', stack: left }, { width: 'auto', stack: right }], columnGap: 20 });
    content.push(rule(2.5, ac, [0, 10, 0, 0]));
  } else if (tpl === 'ats') {
    content.push({ text: b.name, fontSize: 22, bold: true, color: '#000000' });
    if (b.title) content.push({ text: b.title, fontSize: 12, color: '#333333', margin: [0, 3, 0, 0] });
    if (contact) content.push({ text: contact, fontSize: 10, color: '#222222', margin: [0, 7, 0, 0] });
    if (extra) content.push({ text: extra, fontSize: 9, color: '#444444', margin: [0, 3, 0, 0] });
  } else if (tpl === 'panel') {
    content.push({ text: b.name, fontSize: 24, bold: true, color: INK });
    if (b.title) content.push({ text: b.title, fontSize: 12, color: GREY, margin: [0, 3, 0, 0] });
    content.push(rule(0.8, '#D5D9DF', [0, 10, 0, 0]));
  } else if (tpl === 'creative') {
    content.push({ text: b.name, fontSize: 28, bold: true, color: ac });
    if (b.title) content.push({ text: b.title, fontSize: 12.5, color: GREY, margin: [0, 3, 0, 0] });
    content.push(rule(2, ac, [0, 10, 0, 0], 44));
  } else if (tpl === 'nordic') {
    const text: Node[] = [{ text: b.name, fontSize: 24, bold: true, color: INK }];
    if (b.title) text.push({ text: b.title, fontSize: 12.5, color: ac, margin: [0, 3, 0, 0] });
    const pad = Math.max(0, (headD - 42) / 2);
    content.push({
      columns: [
        photo ? photoNode(headD) : { width: 0, text: '' },
        { width: '*', stack: text, margin: [0, photo ? pad : 0, 0, 0] },
      ],
      columnGap: photo ? 18 : 0,
    });
    content.push(rule(0.8, '#D5D9DF', [0, 10, 0, 0]));
  } else {
    const minimal = tpl === 'minimal';
    const alignment = minimal ? 'center' : 'left';
    content.push({
      text: minimal ? b.name.toUpperCase() : b.name,
      fontSize: minimal ? 21 : 25,
      bold: !minimal,
      characterSpacing: minimal ? 2.5 : 0,
      alignment,
      color: INK,
    });
    if (b.title) {
      content.push({ text: b.title, fontSize: 12.5, color: minimal ? GREY : ac, alignment, margin: [0, 3, 0, 0] });
    }
    if (contact) content.push({ text: contact, fontSize: 9.5, color: '#444444', alignment, margin: [0, 7, 0, 0] });
    if (extra) content.push({ text: extra, fontSize: 8.5, color: GREY, alignment, margin: [0, 3, 0, 0] });
  }

  /* ---------- nagłówki sekcji ---------- */
  const heading = (text: string): Node[] => {
    const up = text.toUpperCase();
    const top = (tpl === 'industrial' ? 12 : 16) * k;
    switch (tpl) {
      case 'classic':
        return [
          { text: up, fontSize: 10.5, bold: true, color: ac, characterSpacing: 1.1, margin: [0, top, 0, 2] },
          rule(1, ac, [0, 0, 0, 6]),
        ];
      case 'modern':
        return [{ text: up, fontSize: 11, bold: true, color: ac, characterSpacing: 1.2, margin: [0, top, 0, 5] }];
      case 'panel':
        return [
          { text, fontSize: 12.5, bold: true, color: INK, margin: [0, top, 0, 3] },
          rule(0.8, '#D5D9DF', [0, 0, 0, 7]),
        ];
      case 'creative':
        return [
          { text: up, fontSize: 10.5, bold: true, color: ac, characterSpacing: 1.2, margin: [0, top, 0, 2] },
          rule(1.6, ac, [0, 0, 0, 6]),
        ];
      case 'nordic':
        return [
          { text: up, fontSize: 10, bold: true, color: ac, characterSpacing: 1.3, margin: [0, top, 0, 2] },
          rule(0.7, '#D5D9DF', [0, 0, 0, 6]),
        ];
      case 'technical':
        return [
          { text: up, fontSize: 10.5, bold: true, color: INK, characterSpacing: 1.2, margin: [0, top, 0, 2] },
          rule(2.5, ac, [0, 2, 0, 6], 28),
        ];
      case 'ats':
        return [
          { text: up, fontSize: 10.5, bold: true, color: '#000000', characterSpacing: 1, margin: [0, top, 0, 2] },
          rule(0.6, '#8A8F96', [0, 0, 0, 6]),
        ];
      case 'executive':
        return [
          { text: up, fontSize: 10.5, bold: true, color: ac, characterSpacing: 1.2, margin: [0, top, 0, 2] },
          rule(2.5, GOLD, [0, 2, 0, 6], 36),
        ];
      case 'bold':
        return [
          {
            columns: [
              { width: 12, canvas: [{ type: 'rect', x: 0, y: 2.5, w: 7, h: 7, color: ac }] },
              { width: '*', text: up, fontSize: 11, bold: true, color: NIGHT, characterSpacing: 1.2 },
            ],
            margin: [0, top, 0, 6],
          },
        ];
      case 'industrial':
        return [
          {
            table: { widths: ['*'], body: [[{ text: up, fontSize: 10.5, bold: true, color: '#ffffff', characterSpacing: 1.2 }]] },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 8,
              paddingRight: () => 8,
              paddingTop: () => 3,
              paddingBottom: () => 3,
              fillColor: () => ac,
            },
            margin: [0, top, 0, 7],
          },
        ];
      case 'elegant': {
        const mid = contentW / 2;
        return [
          { text: up, fontSize: 10.5, color: ac, characterSpacing: 2.4, alignment: 'center', margin: [0, top, 0, 3] },
          {
            canvas: [{ type: 'line', x1: mid - 22, y1: 0, x2: mid + 22, y2: 0, lineWidth: 0.8, lineColor: GOLD_LINE }],
            margin: [0, 0, 0, 7],
          },
        ];
      }
      default:
        return [
          { text: up, fontSize: 9, color: GREY, characterSpacing: 1.8, margin: [0, top, 0, 2] },
          rule(0.5, '#BFC5CC', [0, 0, 0, 6]),
        ];
    }
  };

  const section = (title: string, nodes: Node[]): void => {
    content.push(...heading(title), ...nodes);
  };

  const markerColor = tpl === 'ats' ? '#111111' : tpl === 'executive' ? GOLD : tpl === 'elegant' ? GOLD_LINE : ac;
  const orgColor = tpl === 'technical' ? ac : '#444444';
  const dateStyle: Node = tpl === 'bold' ? { color: ac, bold: true } : { color: GREY };

  const entry = (role: string, org: string, dates: string, bullets: string[]): Node => {
    const roleStack: Node[] = [{ text: role, bold: true, fontSize: 10.5 }];
    if (org) roleStack.push({ text: org, color: orgColor, fontSize: 10, italics: tpl === 'panel' });
    if (tpl === 'minimal') {
      const inner: Node[] = roleStack.slice();
      if (bullets.length) inner.push({ ul: bullets, markerColor, margin: [0, 3, 0, 0] });
      return {
        columns: [
          { width: 82, text: dates, fontSize: 9, color: GREY, margin: [0, 1, 0, 0] },
          { width: '*', stack: inner },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 8 * k],
        unbreakable: true,
      };
    }
    const stack: Node[] = [
      {
        columns: [
          { width: '*', stack: roleStack },
          { width: 'auto', text: dates, fontSize: 9.5, ...dateStyle },
        ],
        columnGap: 10,
      },
    ];
    if (bullets.length) stack.push({ ul: bullets, markerColor, margin: [8, 3, 0, 0] });
    return { stack, margin: [0, 0, 0, 8 * k] };
  };

  /* ---------- treść ---------- */
  if (d.summary.trim()) section(L.summary, [{ text: d.summary.trim() }]);

  const exp = filledExperience(d);
  if (exp.length) {
    section(
      L.exp,
      exp.map((e) => entry(e.role, [e.company, e.city].filter(Boolean).join(', '), dateRange(e, L), lines(e.bullets))),
    );
  }

  const edu = filledEducation(d);
  if (edu.length) {
    section(
      L.edu,
      edu.map((e) => {
        const title = [e.degree, e.field].filter(Boolean).join(', ') || e.school;
        const org = e.degree || e.field ? e.school : '';
        return entry(title, org, dateRange({ from: e.from, to: e.to }, L), []);
      }),
    );
  }

  const hard = list(d.skillsHard);
  const soft = list(d.skillsSoft);
  const skills: Node[] = [];
  if (hard.length) skills.push({ text: [{ text: `${L.hard}: `, bold: true }, hard.join(', ')], margin: [0, 0, 0, 3] });
  if (soft.length) skills.push({ text: [{ text: `${L.soft}: `, bold: true }, soft.join(', ')], margin: [0, 0, 0, 3] });
  if (has.skills && skills.length) section(L.skills, skills);

  const langs = filledLanguages(d);
  if (has.langs && langs.length) {
    section(L.lang, [{ text: langs.map((l) => `${l.name} – ${levelLabel(l.level, L)}`).join('   •   ') }]);
  }
  if (has.interests && d.interests.trim()) section(L.interests, [{ text: d.interests.trim() }]);

  content.push(rule(0.5, tpl === 'elegant' ? '#D9CFB8' : '#D5D9DF', [0, 18 * k, 0, 6]));
  content.push({ text: documentClause(cv), fontSize: 8, italics: true, color: '#666666' });

  /* ---------- tło: kolorowe prostokąty i paski boczne (zawartość paska tylko na pierwszej stronie) ---------- */
  const layers = (currentPage: number): Node[] => {
    const out: Node[] = [];
    if (tpl === 'elegant') {
      out.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: CREAM }], absolutePosition: { x: 0, y: 0 } });
    }
    if (side) {
      const bg = tpl === 'creative' ? CREATIVE_SIDE : tpl === 'nordic' ? tint(ac) : ac;
      const x0 = side === 'left' ? 0 : PAGE_W - sideW;
      out.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: sideW, h: PAGE_H, color: bg }], absolutePosition: { x: x0, y: 0 } });
      if (tpl === 'creative') {
        out.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: 8, color: ac }], absolutePosition: { x: 0, y: 0 } });
      }
      if (currentPage === 1) {
        const innerW = sideW - 2 * SIDE_PAD;
        const light = tpl !== 'nordic';
        const textColor = light ? '#ffffff' : INK;
        const subColor = light ? '#E6EAF0' : '#444444';
        const sideHeading = (text: string, top: number): Node[] =>
          light
            ? [
                { text, fontSize: 11, bold: true, color: '#ffffff', margin: [0, top, 0, 3] },
                rule(tpl === 'creative' ? 1.6 : 0.8, tpl === 'creative' ? ac : '#ffffff', [0, 0, 0, 7], innerW),
              ]
            : [
                { text: text.toUpperCase(), fontSize: 9.5, bold: true, color: ac, characterSpacing: 1.2, margin: [0, top, 0, 3] },
                rule(0.8, ac, [0, 0, 0, 7], innerW),
              ];
        const nodes: Node[] = [];
        if (photo && tpl === 'panel') nodes.push({ image: photo, width: panelD, height: panelD, alignment: 'center', margin: [0, 0, 0, 18] });
        sideBlocks(cv, L).forEach((blk, i) => {
          nodes.push(...sideHeading(blk.title, i === 0 ? 0 : 18));
          if (blk.kind === 'rows') {
            for (const r of blk.rows) {
              nodes.push({ text: r.label, fontSize: 8.5, bold: true, color: textColor, margin: [0, 5, 0, 0] });
              nodes.push({ text: r.value, fontSize: 8.5, color: subColor });
            }
          } else if (blk.kind === 'langs') {
            for (const l of blk.langs) {
              nodes.push({
                columns: [
                  { width: '*', text: l.name, fontSize: 8.5, bold: true, color: textColor },
                  { width: 'auto', text: l.level, fontSize: 8.5, color: subColor },
                ],
                columnGap: 6,
                margin: [0, 3, 0, 0],
              });
            }
          } else {
            for (const item of blk.items) {
              nodes.push({ text: item, fontSize: 8.5, bold: tpl === 'panel', color: textColor, margin: [0, 3, 0, 0] });
            }
          }
        });
        const y0 = tpl === 'creative' ? 44 : 34;
        const x = (side === 'left' ? 0 : PAGE_W - sideW) + SIDE_PAD;
        out.push({ absolutePosition: { x, y: y0 }, columns: [{ width: innerW, stack: nodes }] });
      }
    }
    return out;
  };
  const needsBackground = tpl === 'elegant' || side !== undefined;

  return {
    pageSize: 'A4',
    pageMargins: margins,
    content,
    defaultStyle: { font: 'Roboto', fontSize: tpl === 'ats' ? 10.5 : 10, lineHeight: 1.25, color: INK },
    info: { title: `CV ${b.name}`.trim(), author: b.name, subject: 'CV' },
    footer: (currentPage, pageCount) =>
      pageCount > 1
        ? { text: `${currentPage} / ${pageCount}`, alignment: 'center', fontSize: 8, color: '#999999', margin: [0, 14, 0, 0] }
        : { text: '', fontSize: 1 },
    ...(needsBackground ? { background: (currentPage: number) => ({ stack: layers(currentPage) }) } : {}),
  };
}

/** Bezpieczna nazwa pliku: bez polskich znaków i spacji. */
export function pdfFileName(cv: Pick<Cv, 'name' | 'data'>): string {
  const base = cv.data.basics.name || cv.name || 'CV';
  const ascii = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `CV_${ascii || 'cv'}.pdf`;
}
