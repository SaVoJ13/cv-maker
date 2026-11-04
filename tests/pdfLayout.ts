import { createRequire } from 'node:module';
import { buildPdfDocument } from '../src/domain/pdf.ts';
import { showsPhoto } from '../src/domain/cvOps.ts';
import { DOC, EXTRAS_DOC } from '../src/domain/docText.ts';
import { SIDEBAR } from '../src/domain/templates.ts';
import type { Cv, DocLang, TemplateId } from '../src/domain/types.ts';

/**
 * Допоміжний код для тестів: справжня розкладка pdfmake в Node. Повертає рядки кожної сторінки з
 * координатами, тож можна перевірити, чи заголовок не лишився сам унизу й чи немає великих порожнин.
 */
const require = createRequire(import.meta.url);
const pdfMake = require('pdfmake/build/pdfmake.js') as {
  vfs: unknown;
  createPdf: (doc: unknown) => { getBuffer: (cb: (b: Uint8Array) => void) => void };
};
const fonts = require('pdfmake/build/vfs_fonts.js') as { pdfMake?: { vfs: unknown } };
pdfMake.vfs = fonts.pdfMake ? fonts.pdfMake.vfs : fonts;

/** 1×1 PNG: достатньо, щоб шаблони з фото намалювали місце під зображення. */
export const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const PAGE_H = 841.89;
/** Нижня межа вмісту (поле 44 pt); усе нижче — колонтитул. */
export const CONTENT_BOTTOM = PAGE_H - 44;

export interface LaidLine {
  text: string;
  x: number;
  y: number;
  h: number;
}

export interface LaidPage {
  lines: LaidLine[];
  /** Найнижча точка вмісту (рядки й зображення; фонові прямокутники не рахуємо) без колонтитула */
  bottom: number;
}

interface RawItem {
  type: string;
  item: { x?: number; y?: number; h?: number; _height?: number; type?: string; inlines?: Array<{ text: string }>; getHeight?: () => number };
}

export function layoutPages(cv: Cv): Promise<LaidPage[]> {
  const doc = buildPdfDocument(cv, showsPhoto(cv) ? PNG : undefined);
  let captured: Array<{ items: RawItem[] }> | null = null;
  // pdfmake кладе розкладені сторінки у властивість _pdfMakePages документа PDFKit; перехоплюємо присвоєння
  Object.defineProperty(Object.prototype, '_pdfMakePages', {
    configurable: true,
    set(v: Array<{ items: RawItem[] }>) {
      captured = v;
      Object.defineProperty(this, '_pdfMakePages', { value: v, writable: true, configurable: true, enumerable: false });
    },
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 20_000);
    pdfMake.createPdf(doc).getBuffer(() => {
      clearTimeout(timer);
      delete (Object.prototype as { _pdfMakePages?: unknown })._pdfMakePages;
      if (!captured) return reject(new Error('pdfmake не віддав сторінки'));
      resolve(
        captured.map((pg) => {
          const lines: LaidLine[] = [];
          let bottom = 0;
          for (const it of pg.items) {
            const y = it.item.y;
            if (y !== undefined && y >= CONTENT_BOTTOM) continue;
            if (it.type === 'line' && y !== undefined && it.item.getHeight && it.item.inlines) {
              const h = it.item.getHeight();
              lines.push({ text: it.item.inlines.map((i) => i.text).join(''), x: it.item.x ?? 0, y, h });
              bottom = Math.max(bottom, y + h);
            } else if (it.type === 'image' && y !== undefined) bottom = Math.max(bottom, y + (it.item._height ?? 0));
          }
          return { lines, bottom };
        }),
      );
    });
  });
}

/** Найбільша порожнина внизу сторінки (частка висоти A4) серед усіх сторінок, крім останньої. */
export function maxBottomGap(pages: LaidPage[]): number {
  let gap = 0;
  pages.slice(0, -1).forEach((p) => {
    gap = Math.max(gap, (CONTENT_BOTTOM - p.bottom) / PAGE_H);
  });
  return gap;
}

/** Увесь текст документа одним рядком. */
export function allText(pages: LaidPage[]): string {
  return pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n');
}

/** Назви всіх розділів документа мовою CV (для пошуку рядків-заголовків на сторінках). */
function headingTexts(lang: DocLang): Set<string> {
  const L = DOC[lang];
  const E = EXTRAS_DOC[lang];
  return new Set([L.summary, L.exp, L.edu, L.skills, L.lang, L.interests, E.driverTitle, E.techTitle, E.coursesTitle].map((x) => x.toLowerCase()));
}

/** Заголовки, після яких на сторінці в тій самій колонці вже немає жодного рядка. */
export function orphanHeadings(pages: LaidPage[], tpl: TemplateId, lang: DocLang): string[] {
  const names = headingTexts(lang);
  const side = SIDEBAR[tpl];
  const inMain = (x: number): boolean => (side === 'left' ? x >= 170 : side === 'right' ? x < 420 : true);
  const out: string[] = [];
  pages.forEach((p, i) => {
    for (const l of p.lines) {
      if (!names.has(l.text.trim().toLowerCase()) || !inMain(l.x)) continue;
      const below = p.lines.some((o) => o !== l && o.y > l.y + 1 && inMain(o.x));
      if (!below) out.push(`${l.text} (сторінка ${i + 1})`);
    }
  });
  return out;
}

