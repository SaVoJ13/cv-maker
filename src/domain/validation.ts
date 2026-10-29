import { dateKey } from './cvOps';

/**
 * Lekka walidacja pól formularza. Nic nie blokuje wpisywania ani zapisu:
 * funkcje tylko mówią, czy pokazać podpowiedź przy polu. Puste pole nigdy nie jest błędem.
 */

export function emailProblem(v: string): boolean {
  const s = v.trim();
  return s !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

/** MM.RRRR (także z / lub -) albo samo RRRR. */
export function monthProblem(v: string): boolean {
  const s = v.trim();
  return s !== '' && !/^((0?[1-9]|1[0-2])[./-])?\d{4}$/.test(s);
}

export function yearProblem(v: string): boolean {
  const s = v.trim();
  return s !== '' && !/^\d{4}$/.test(s);
}

/** Zakończenie wcześniej niż rozpoczęcie (sprawdzamy tylko, gdy obie daty są poprawne). */
export function rangeProblem(from: string, to: string, current = false): boolean {
  if (current || !from.trim() || !to.trim()) return false;
  if (monthProblem(from) || monthProblem(to)) return false;
  return dateKey(to) < dateKey(from);
}
