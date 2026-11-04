import type { IndustryId, TemplateId, Tier } from './types';

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
  'driver',
  'trades',
  'student',
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
  /** Darmowy czy PRO. Wpływa dopiero na eksport PDF (paywall w Sprincie 5), edytować można każdy. */
  tier: Tier;
  /** Branża, dla której szablon jest przeznaczony; brak = uniwersalny. */
  industry?: IndustryId;
}

export const TEMPLATE_META: Record<TemplateId, TemplateMeta> = {
  classic: { photo: false, ats: 'high', atsSafe: true, tier: 'free' },
  modern: { photo: true, ats: 'high', atsSafe: true, tier: 'pro' },
  minimal: { photo: false, ats: 'high', atsSafe: true, tier: 'free' },
  executive: { photo: true, ats: 'medium', atsSafe: true, tier: 'pro' },
  creative: { photo: false, ats: 'low', atsSafe: false, tier: 'pro' },
  technical: { photo: false, ats: 'high', atsSafe: true, tier: 'pro' },
  ats: { photo: false, ats: 'high', atsSafe: true, tier: 'free' },
  panel: { photo: true, ats: 'low', atsSafe: false, tier: 'pro' },
  elegant: { photo: false, ats: 'medium', atsSafe: true, tier: 'pro' },
  bold: { photo: false, ats: 'medium', atsSafe: true, tier: 'pro' },
  industrial: { photo: false, ats: 'medium', atsSafe: true, tier: 'free', industry: 'production_cnc' },
  nordic: { photo: true, ats: 'low', atsSafe: false, tier: 'pro' },
  driver: { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'drivers' },
  trades: { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'construction' },
  student: { photo: true, ats: 'medium', atsSafe: true, tier: 'pro', industry: 'students' },
};

/** Szablony z paskiem bocznym (dwie kolumny) i strona paska. */
export const SIDEBAR: Partial<Record<TemplateId, 'left' | 'right'>> = {
  panel: 'left',
  creative: 'left',
  nordic: 'right',
};

/** Czy szablon jest darmowy. Nieznany (np. przyszły) traktujemy jako PRO. */
export function templateTier(id: TemplateId): Tier {
  return TEMPLATE_META[id]?.tier ?? 'pro';
}

export const FREE_TEMPLATES: readonly TemplateId[] = TEMPLATES.filter((k) => TEMPLATE_META[k].tier === 'free');
