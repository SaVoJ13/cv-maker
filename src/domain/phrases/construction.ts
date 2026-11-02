import { group } from './make';

const s = group('construction', 'summary');
const e = group('construction', 'experience');
const k = group('construction', 'skills');

export const CONSTRUCTION = [
  s(1, ['Pracownik budowlany', 'Будівельник', 'Construction worker'], [
    'Osoba pracowita i dokładna, dbająca o jakość wykonania, bezpieczeństwo na budowie i terminowość.',
    'Hard-working and precise construction worker. Cares about quality of work, site safety and meeting deadlines.',
  ]),
  s(2, ['Prace wykończeniowe', 'Оздоблювальні роботи', 'Finishing work'], [
    'Doświadczenie w pracach wykończeniowych. Zwraca uwagę na szczegóły i estetykę wykonania.',
    'Experience in finishing work. Pays attention to detail and the look of the final result.',
  ]),
  s(3, ['Praca w zespole na budowie', 'Командна робота на об’єкті', 'Teamwork on site'], [
    'Dobrze pracuje w zespole, wykonuje polecenia kierownika budowy i szybko uczy się nowych zadań.',
    'Works well in a team, follows the site manager’s instructions and learns new tasks quickly.',
  ]),
  s(4, ['Szukam pracy na budowie', 'Шукаю роботу на будові', 'Seeking site work'], [
    'Szukam pracy w branży budowlanej. Cechuje mnie sumienność, wytrzymałość fizyczna i gotowość do pracy w różnych lokalizacjach.',
    'Looking for work in construction. I am conscientious, physically fit and ready to work at different locations.',
  ]),
  e(1, ['Roboty budowlane', 'Будівельні роботи', 'Building work'], [
    'Wykonywanie robót budowlanych zgodnie z projektem i poleceniami kierownika',
    'Carried out building work according to the plan and the manager’s instructions',
  ]),
  e(2, ['Prace wykończeniowe', 'Оздоблення', 'Finishing'], [
    'Prace wykończeniowe: gładzie, malowanie, układanie płytek',
    'Finishing work: plastering, painting, tiling',
  ]),
  e(3, ['Czytanie rysunków', 'Читання креслень', 'Reading drawings'], [
    'Praca na podstawie rysunków i wymiarów z projektu',
    'Worked from drawings and dimensions in the project',
  ]),
  e(4, ['Narzędzia i sprzęt', 'Інструменти й обладнання', 'Tools and equipment'], [
    'Obsługa narzędzi ręcznych i elektronarzędzi',
    'Used hand tools and power tools',
  ]),
  e(5, ['BHP na budowie', 'Охорона праці на об’єкті', 'Site safety'], [
    'Przestrzeganie zasad BHP i dbanie o porządek na placu budowy',
    'Followed health and safety rules and kept the site tidy',
  ]),
  k(1, ['Prace budowlane', 'Будівельні роботи', 'Building work'], [
    'prace budowlane, murowanie, betonowanie',
    'building work, bricklaying, concrete work',
  ]),
  k(2, ['Wykończenie wnętrz', 'Оздоблення приміщень', 'Interior finishing'], [
    'gładzie, malowanie, układanie płytek',
    'plastering, painting, tiling',
  ]),
  k(3, ['Rysunek techniczny', 'Технічні креслення', 'Technical drawings'], [
    'czytanie rysunków technicznych, pomiary',
    'reading technical drawings, measuring',
  ]),
  k(4, ['Narzędzia', 'Інструменти', 'Tools'], [
    'obsługa narzędzi ręcznych i elektronarzędzi',
    'hand tools and power tools',
  ]),
];
