import { QR_QUIET, type QrMatrix } from './qr';

/**
 * Геометрія QR на сторінці: єдина для PDF і прев'ю. Розмір залежить від версії, щоб модуль
 * лишався достатньо великим для камери телефона, а рівні модулів зливались у суцільні смуги.
 */

/** Міліметрів у пункті PDF (1 pt = 25.4/72 мм). */
const PT_PER_MM = 72 / 25.4;
/** Мінімальна сторона самого коду (без тихої зони): 24 мм. */
export const QR_MIN_SIDE_PT = 24 * PT_PER_MM;
/** Мінімальний розмір одного модуля, пт. */
export const QR_MIN_MODULE_PT = 1.7;
/** Невелике перекриття рядків, щоб між ними не з'являлись світлі шви при растеризації переглядачем. */
export const QR_OVERLAP_PT = 0.1;

export interface QrRun {
  row: number;
  /** Перший темний модуль серії */
  col: number;
  /** Скільки темних модулів поспіль */
  len: number;
}

export interface QrGeometry {
  /** Модуль, пт */
  module: number;
  /** Сторона самого коду, пт (без тихої зони) */
  side: number;
  /** Сторона разом із тихою зоною, пт */
  total: number;
  /** Тиха зона, пт (з кожного боку) */
  quiet: number;
}

/** Розміри для даної сторони матриці (у модулях): не менше 24 мм і не менше 1.7 пт на модуль. */
export function qrGeometry(size: number): QrGeometry {
  const side = Math.max(QR_MIN_SIDE_PT, size * QR_MIN_MODULE_PT);
  const module = side / size;
  const quiet = QR_QUIET * module;
  return { module, side, total: side + 2 * quiet, quiet };
}

/** Горизонтальні серії темних модулів: кожна серія малюється одним прямокутником. */
export function darkRuns(matrix: QrMatrix): QrRun[] {
  const runs: QrRun[] = [];
  for (let row = 0; row < matrix.size; row++) {
    let col = 0;
    while (col < matrix.size) {
      if (!matrix.modules[row][col]) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < matrix.size && matrix.modules[row][end]) end += 1;
      runs.push({ row, col, len: end - col });
      col = end;
    }
  }
  return runs;
}
