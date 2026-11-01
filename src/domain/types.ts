/** Мова інтерфейсу. 'uk' додається в кроці 6 разом зі словником. */
export type UiLang = 'pl' | 'en';
/** Мова тексту самого документа CV (польська або англійська). */
export type DocLang = 'pl' | 'en';
export type TemplateId =
  | 'classic'
  | 'modern'
  | 'minimal'
  | 'executive'
  | 'creative'
  | 'technical'
  | 'ats'
  | 'panel'
  | 'elegant'
  | 'bold'
  | 'industrial'
  | 'nordic';
export type AccentId = 'navy' | 'azure' | 'graphite' | 'emerald' | 'burgundy' | 'crimson';
export type DensityId = 'compact' | 'normal' | 'airy';
export type RodoMode = 'current' | 'future';
export type LangLevel = 'native' | 'C2' | 'C1' | 'B2' | 'B1' | 'A2' | 'A1';

export interface Basics {
  name: string;
  title: string;
  email: string;
  phone: string;
  city: string;
  link: string;
  /** Dobrowolne dane dodatkowe */
  address: string;
  birthDate: string;
  birthPlace: string;
  /** Prawo jazdy, np. „B, C" */
  license: string;
  /** Zdjęcie jako data URL (JPEG). Pusty napis = brak zdjęcia. */
  photo: string;
  /** Kadr: położenie 0–100 w poziomie i w pionie, przybliżenie 1–3, rozmiar ramki 70–125 % */
  photoX: number;
  photoY: number;
  photoZoom: number;
  photoSize: number;
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  city: string;
  /** MM.RRRR */
  from: string;
  /** MM.RRRR; ignorowane, gdy current === true */
  to: string;
  current: boolean;
  /** Jedna linia = jeden punkt */
  bullets: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  field: string;
  from: string;
  to: string;
}

export interface LanguageSkill {
  id: string;
  name: string;
  level: LangLevel;
}

export interface CvData {
  basics: Basics;
  summary: string;
  experience: Experience[];
  education: Education[];
  /** Po przecinku */
  skillsHard: string;
  skillsSoft: string;
  languages: LanguageSkill[];
  interests: string;
}

export interface Cv {
  id: string;
  /** Nazwa wersji widoczna na pulpicie */
  name: string;
  updated: number;
  /** Język dokumentu (nie interfejsu) */
  lang: DocLang;
  tpl: TemplateId;
  accent: AccentId;
  density: DensityId;
  rodo: RodoMode;
  /** Stanowisko wpisane w klauzuli RODO */
  rodoTarget: string;
  example: boolean;
  data: CvData;
}
