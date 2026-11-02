import { group } from './make';

const s = group('students', 'summary');
const e = group('students', 'experience');
const k = group('students', 'skills');

export const STUDENTS = [
  s(1, ['Student – pierwsza praca', 'Студент – перша робота', 'Student – first job'], [
    'Student poszukujący pierwszego doświadczenia zawodowego. Szybko się uczę, jestem zaangażowany i chętnie podejmuję nowe zadania.',
    'Student looking for first work experience. I learn fast, I am committed and I take on new tasks willingly.',
  ]),
  s(2, ['Praca dorywcza', 'Підробіток', 'Part-time work'], [
    'Szukam pracy dorywczej, którą mogę łączyć ze studiami. Jestem elastyczny, punktualny i odpowiedzialny.',
    'Looking for part-time work that fits around my studies. I am flexible, punctual and responsible.',
  ]),
  s(3, ['Staż / praktyka', 'Стажування / практика', 'Internship'], [
    'Szukam stażu lub praktyki, aby wykorzystać wiedzę ze studiów w praktyce. Ciekawy świata, otwarty na uwagi i rozwój.',
    'Looking for an internship to apply my university knowledge in practice. Curious, open to feedback and keen to grow.',
  ]),
  s(4, ['Absolwent', 'Випускник', 'Graduate'], [
    'Absolwent z solidnymi podstawami teoretycznymi, gotowy do rozpoczęcia kariery. Dobrze organizuje pracę i potrafi współpracować w grupie.',
    'Graduate with solid theoretical foundations, ready to start a career. Organises work well and collaborates easily in a group.',
  ]),
  e(1, ['Projekty na studiach', 'Навчальні проєкти', 'University projects'], [
    'Realizacja projektów grupowych w ramach studiów',
    'Carried out group projects as part of my studies',
  ]),
  e(2, ['Praktyka', 'Практика', 'Placement'], [
    'Wykonywanie zadań pod opieką opiekuna praktyk',
    'Performed tasks under the guidance of a placement supervisor',
  ]),
  e(3, ['Wolontariat', 'Волонтерство', 'Volunteering'], [
    'Udział w wolontariacie i organizacji wydarzeń',
    'Took part in volunteering and event organisation',
  ]),
  e(4, ['Koło naukowe', 'Студентський гурток', 'Student society'], [
    'Aktywna działalność w kole naukowym lub organizacji studenckiej',
    'Active in a student society or organisation',
  ]),
  e(5, ['Praca dorywcza', 'Підробіток', 'Part-time job'], [
    'Praca dorywcza łączona ze studiami',
    'Part-time work alongside studies',
  ]),
  k(1, ['Szybkie uczenie się', 'Швидке навчання', 'Quick learning'], [
    'szybkie uczenie się, samodzielność',
    'quick learning, independence',
  ]),
  k(2, ['Praca w grupie', 'Робота в групі', 'Teamwork'], [
    'praca w zespole, komunikatywność',
    'teamwork, communication',
  ]),
  k(3, ['Organizacja czasu', 'Організація часу', 'Time management'], [
    'organizacja czasu, terminowość',
    'time management, meeting deadlines',
  ]),
  k(4, ['Programy komputerowe', 'Комп’ютерні програми', 'Computer skills'], [
    'MS Office, praca z komputerem',
    'MS Office, computer skills',
  ]),
];
