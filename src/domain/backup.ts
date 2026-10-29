import type { Cv } from './types';
import { normalizeCv, uid } from './cvOps';

/** Format pliku kopii zapasowej. Zmiana struktury = nowy numer wersji. */
export const BACKUP_APP = 'free-cv-backup';
export const BACKUP_VERSION = 1;

/** Własne CV (bez przykładu) zapisane jako tekst JSON. */
export function serializeBackup(cvs: readonly Cv[], now = Date.now()): string {
  const own = cvs.filter((c) => !c.example);
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now, cvs: own });
}

export function backupFileName(now = Date.now()): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `cv-maker-kopia-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export type ParsedBackup = { ok: true; cvs: Cv[] } | { ok: false; reason: 'format' | 'empty' };

/**
 * Wczytuje kopię zapasową z tekstu. Każde CV przechodzi przez `normalizeCv`,
 * więc uszkodzone pola są naprawiane, a obce pliki JSON odrzucane.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: 'format' };
  const o = raw as Record<string, unknown>;
  if (o.app !== BACKUP_APP || typeof o.version !== 'number' || o.version > BACKUP_VERSION || !Array.isArray(o.cvs)) {
    return { ok: false, reason: 'format' };
  }
  const cvs = o.cvs
    .map(normalizeCv)
    .filter((c): c is Cv => c !== null)
    .map((c) => ({ ...c, example: false }));
  return cvs.length ? { ok: true, cvs } : { ok: false, reason: 'empty' };
}

/**
 * Które CV z kopii dodać do istniejących. To samo CV (ten sam identyfikator i data zmiany),
 * np. po wczytaniu tej samej kopii dwa razy, jest pomijane. Różna wersja dostaje nowy
 * identyfikator, więc nic, co użytkownik ma na urządzeniu, nie zostaje nadpisane.
 */
export function planImport(existing: readonly Cv[], imported: readonly Cv[]): { toAdd: Cv[]; skipped: number } {
  const byId = new Map(existing.map((c) => [c.id, c]));
  const toAdd: Cv[] = [];
  let skipped = 0;
  for (const cv of imported) {
    const same = byId.get(cv.id);
    if (!same) {
      toAdd.push(cv);
      byId.set(cv.id, cv);
    } else if (same.updated === cv.updated) {
      skipped++;
    } else {
      const copy = structuredClone(cv);
      copy.id = uid();
      toAdd.push(copy);
      byId.set(copy.id, copy);
    }
  }
  return { toAdd, skipped };
}
