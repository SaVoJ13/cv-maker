import { group } from './make';

const s = group('production_cnc', 'summary');
const e = group('production_cnc', 'experience');
const k = group('production_cnc', 'skills');

export const PRODUCTION_CNC = [
  s(1, ['Operator produkcji', 'Оператор виробництва', 'Production operator'], [
    'Dokładny operator produkcji, który dba o jakość wyrobów i bezpieczeństwo na stanowisku. Dobrze pracuje w systemie zmianowym.',
    'Careful production operator who cares about product quality and workplace safety. Works well on shifts.',
  ]),
  s(2, ['Operator maszyn', 'Оператор верстатів', 'Machine operator'], [
    'Doświadczenie w obsłudze maszyn produkcyjnych. Zwraca uwagę na wymiary, tolerancje i powtarzalność wykonania.',
    'Experience operating production machines. Pays attention to dimensions, tolerances and repeatability.',
  ]),
  s(3, ['Kontrola jakości', 'Контроль якості', 'Quality control'], [
    'Skrupulatna osoba z nastawieniem na kontrolę jakości. Potrafi czytać dokumentację techniczną i zgłaszać nieprawidłowości.',
    'Meticulous person focused on quality control. Able to read technical documentation and report non-conformities.',
  ]),
  s(4, ['Szukam pracy na produkcji', 'Шукаю роботу на виробництві', 'Seeking production role'], [
    'Szukam pracy na produkcji lub przy obsłudze maszyn. Jestem sumienny, chętny do nauki i gotowy do pracy zmianowej.',
    'Looking for a production or machine operation role. I am conscientious, keen to learn and ready for shift work.',
  ]),
  e(1, ['Obsługa maszyn', 'Робота на верстатах', 'Machine operation'], [
    'Obsługa maszyn produkcyjnych zgodnie z instrukcją stanowiskową',
    'Operated production machines according to work instructions',
  ]),
  e(2, ['Kontrola wymiarów', 'Контроль розмірів', 'Dimension checks'], [
    'Kontrola wymiarów wyrobów przy użyciu narzędzi pomiarowych',
    'Checked product dimensions using measuring tools',
  ]),
  e(3, ['Rysunki techniczne', 'Технічні креслення', 'Technical drawings'], [
    'Praca na podstawie rysunków technicznych i kart technologicznych',
    'Worked from technical drawings and process sheets',
  ]),
  e(4, ['Ustawianie maszyn', 'Налаштування обладнання', 'Machine setup'], [
    'Przygotowanie i ustawianie maszyn do produkcji kolejnych serii',
    'Prepared and set up machines for subsequent production runs',
  ]),
  e(5, ['Porządek i BHP', 'Порядок і охорона праці', 'Order and safety'], [
    'Utrzymywanie porządku na stanowisku i przestrzeganie zasad BHP',
    'Kept the workstation tidy and followed health and safety rules',
  ]),
  k(1, ['Obsługa maszyn', 'Обслуговування верстатів', 'Machine operation'], [
    'obsługa maszyn produkcyjnych, praca na linii',
    'production machine operation, line work',
  ]),
  k(2, ['Pomiary i kontrola', 'Вимірювання і контроль', 'Measuring and control'], [
    'narzędzia pomiarowe, kontrola jakości',
    'measuring tools, quality control',
  ]),
  k(3, ['Dokumentacja techniczna', 'Технічна документація', 'Technical documentation'], [
    'czytanie rysunków technicznych, dokumentacja technologiczna',
    'reading technical drawings, process documentation',
  ]),
  k(4, ['Organizacja stanowiska', 'Організація робочого місця', 'Workstation organisation'], [
    'organizacja stanowiska pracy, zasady BHP',
    'workstation organisation, health and safety rules',
  ]),
];
