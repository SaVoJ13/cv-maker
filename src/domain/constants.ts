import type { AccentId, DensityId, LangLevel } from './types';

export const ACCENTS: Record<AccentId, string> = {
  navy: '#1F3A5F',
  azure: '#1D5FBF',
  graphite: '#2B2F36',
  emerald: '#0E7C66',
  burgundy: '#7A1F3D',
  crimson: '#B3262E',
};

export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

/** Mnożnik odstępów w dokumencie */
export const DENSITY: Record<DensityId, number> = {
  compact: 0.82,
  normal: 1,
  airy: 1.2,
};

export const DENSITY_IDS: readonly DensityId[] = ['compact', 'normal', 'airy'];
export const LEVELS: readonly LangLevel[] = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];

/** A4 przy 96 dpi */
export const A4_W = 794;
export const A4_H = 1123;
