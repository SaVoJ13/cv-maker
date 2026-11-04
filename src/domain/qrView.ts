import type { Cv } from './types';
import { qrMatrix, type QrMatrix } from './qr';
import { validateQrUrl } from './qrUrl';

/**
 * Що саме друкується для QR. Друкуємо лише тоді, коли код увімкнено і посилання пройшло перевірку
 * (https, довжина, без логіна…). Нічого не підставляється: порожнє чи хибне посилання = немає блоку.
 */
export interface QrView {
  /** Посилання, яке кодується (рівно те, що ввів користувач, без зайвих пробілів) */
  url: string;
  /** Те саме для друку текстом: без «https://» і кінцевої «/» */
  display: string;
  /** Підпис над посиланням; порожній рядок, якщо не задано */
  label: string;
  matrix: QrMatrix;
}

export function qrView(cv: Pick<Cv, 'data'>): QrView | null {
  const q = cv.data.extras?.qr;
  if (!q || !q.enabled) return null;
  const v = validateQrUrl(q.url);
  if (!v.ok) return null;
  let matrix: QrMatrix;
  try {
    matrix = qrMatrix(v.url);
  } catch {
    return null;
  }
  return { url: v.url, display: v.display, label: q.label.replace(/\s+/g, ' ').trim(), matrix };
}
