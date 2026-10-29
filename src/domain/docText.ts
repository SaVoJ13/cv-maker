import type { Cv, Lang } from './types';

/** Teksty, które trafiają do samego dokumentu CV (nie do interfejsu). */
export interface DocStrings {
  summary: string;
  exp: string;
  edu: string;
  skills: string;
  hard: string;
  soft: string;
  lang: string;
  interests: string;
  present: string;
  native: string;
  personal: string;
  address: string;
  phone: string;
  email: string;
  link: string;
  birthDate: string;
  birthPlace: string;
  license: string;
}

export const DOC: Record<Lang, DocStrings> = {
  pl: {
    summary: 'Podsumowanie zawodowe',
    exp: 'Doświadczenie zawodowe',
    edu: 'Wykształcenie',
    skills: 'Umiejętności',
    hard: 'Twarde',
    soft: 'Miękkie',
    lang: 'Języki',
    interests: 'Zainteresowania',
    present: 'obecnie',
    native: 'ojczysty',
    personal: 'Dane osobowe',
    address: 'Adres',
    phone: 'Telefon',
    email: 'E-mail',
    link: 'Strona',
    birthDate: 'Data urodzenia',
    birthPlace: 'Miejsce urodzenia',
    license: 'Prawo jazdy',
  },
  en: {
    summary: 'Professional summary',
    exp: 'Work experience',
    edu: 'Education',
    skills: 'Skills',
    hard: 'Hard skills',
    soft: 'Soft skills',
    lang: 'Languages',
    interests: 'Interests',
    present: 'present',
    native: 'native',
    personal: 'Personal details',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    link: 'Website',
    birthDate: 'Date of birth',
    birthPlace: 'Place of birth',
    license: 'Driving licence',
  },
};

type RodoCv = Pick<Cv, 'lang' | 'rodo' | 'rodoTarget'>;

/**
 * Klauzula zgody na przetwarzanie danych w rekrutacji (art. 6 ust. 1 lit. a RODO).
 * Wariant „future" dopisuje zgodę na przyszłe rekrutacje.
 * Gdy w dokumencie jest zdjęcie (`withPhoto`), klauzula wymienia też wizerunek.
 * Tekst ma charakter wzoru; jego zgodność z wymaganiami konkretnego pracodawcy
 * powinien potwierdzić prawnik lub inspektor ochrony danych.
 */
export function rodoText(cv: RodoCv, withPhoto = false): string {
  const target = cv.rodoTarget.trim();
  if (cv.lang === 'pl') {
    const where = target ? `stanowisko ${target}` : 'aplikowane przeze mnie stanowisko';
    const data = withPhoto ? 'moich danych osobowych (w tym wizerunku)' : 'moich danych osobowych';
    let s =
      `Wyrażam zgodę na przetwarzanie ${data} w celu prowadzenia rekrutacji na ${where}, ` +
      'zgodnie z art. 6 ust. 1 lit. a Rozporządzenia Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).';
    if (cv.rodo === 'future') {
      s += ' Wyrażam również zgodę na przetwarzanie moich danych osobowych dla potrzeb przyszłych rekrutacji.';
    }
    return s;
  }
  const where = target ? `the position of ${target}` : 'the position I am applying for';
  const data = withPhoto ? 'my personal data (including my image)' : 'my personal data';
  let s =
    `I consent to the processing of ${data} for the purpose of the recruitment process for ${where}, ` +
    'in accordance with Article 6(1)(a) of Regulation (EU) 2016/679 (GDPR).';
  if (cv.rodo === 'future') {
    s += ' I also consent to the processing of my personal data for the purposes of future recruitment processes.';
  }
  return s;
}
