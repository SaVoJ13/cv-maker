import { A4_H } from './constants';

/** Liczba stron A4 dla arkusza o danej wysokości w px (6 px tolerancji na zaokrąglenia). */
export function pageCount(height: number): number {
  return Math.max(1, Math.ceil((height - 6) / A4_H));
}
