import qrcode from 'qrcode-generator';

/**
 * QR-матриця для посилання. Генерація локальна (бібліотека qrcode-generator, MIT, без залежностей
 * і без мережі); решта коду бачить лише цю обгортку. Рівень виправлення M, режим Byte.
 */

/** Найвища дозволена версія: 120 символів при рівні M вміщаються у версію 7. */
export const QR_MAX_VERSION = 7;
/** Тиха зона навколо коду, у модулях (за специфікацією — 4). */
export const QR_QUIET = 4;

export interface QrMatrix {
  /** Версія 1–7 */
  version: number;
  /** Сторона в модулях: 21 + 4·(версія − 1) */
  size: number;
  /** modules[row][col] === true — темний модуль */
  modules: boolean[][];
}

/** Матриця для готового тексту (ASCII). Кидає помилку, якщо текст не вміщується у версію 7. */
export function qrMatrix(text: string): QrMatrix {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const version = (size - 21) / 4 + 1;
  if (version > QR_MAX_VERSION) throw new Error(`QR: текст завеликий (версія ${version})`);
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c++) row.push(qr.isDark(r, c));
    modules.push(row);
  }
  return { version, size, modules };
}
