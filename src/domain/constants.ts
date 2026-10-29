import type { AccentId, DensityId, LangLevel, TemplateId } from './types';

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
/** Kolejność w galerii. */
export const TEMPLATES: readonly TemplateId[] = [
  'classic',
  'modern',
  'minimal',
  'executive',
  'creative',
  'technical',
  'ats',
  'panel',
  'elegant',
  'bold',
  'industrial',
  'nordic',
];

/** Dawne nazwy szablonów, które nadal wczytujemy ze starych zapisów i kopii zapasowych. */
export const LEGACY_TEMPLATES: Readonly<Record<string, TemplateId>> = { portrait: 'nordic' };

export type AtsLevel = 'high' | 'medium' | 'low';

export interface TemplateMeta {
  /** Szablon pokazuje zdjęcie */
  photo: boolean;
  /** Nasza ocena czytelności dla systemów ATS: wysoka (jedna kolumna, zwykły tekst), średnia (jedna kolumna z grafiką w nagłówku), niska (dwie kolumny) */
  ats: AtsLevel;
  /** Nie dwie kolumny: nie wyświetlamy ostrzeżenia o ATS */
  atsSafe: boolean;
}

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  classic: { photo: false, ats: 'high', atsSafe: true },
  modern: { photo: true, ats: 'high', atsSafe: true },
  minimal: { photo: false, ats: 'high', atsSafe: true },
  executive: { photo: true, ats: 'medium', atsSafe: true },
  creative: { photo: false, ats: 'low', atsSafe: false },
  technical: { photo: false, ats: 'high', atsSafe: true },
  ats: { photo: false, ats: 'high', atsSafe: true },
  panel: { photo: true, ats: 'low', atsSafe: false },
  elegant: { photo: false, ats: 'medium', atsSafe: true },
  bold: { photo: false, ats: 'medium', atsSafe: true },
  industrial: { photo: false, ats: 'medium', atsSafe: true },
  nordic: { photo: true, ats: 'low', atsSafe: false },
};

/** Szablony z paskiem bocznym (dwie kolumny) i strona paska. */
export const SIDEBAR: Partial<Record<TemplateId, 'left' | 'right'>> = {
  panel: 'left',
  creative: 'left',
  nordic: 'right',
};

export const LEVELS: readonly LangLevel[] = ['native', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];

/** A4 przy 96 dpi */
export const A4_W = 794;
export const A4_H = 1123;
