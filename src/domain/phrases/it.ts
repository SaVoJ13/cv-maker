import { group } from './make';

const s = group('it', 'summary');
const e = group('it', 'experience');
const k = group('it', 'skills');

export const IT = [
  s(1, ['Programista', 'Програміст', 'Software developer'], [
    'Programista nastawiony na tworzenie czytelnego, dobrze przetestowanego kodu. Lubi rozwiązywać problemy i uczyć się nowych technologii.',
    'Developer focused on writing readable, well-tested code. Enjoys solving problems and learning new technologies.',
  ]),
  s(2, ['Wsparcie IT', 'ІТ-підтримка', 'IT support'], [
    'Osoba komunikatywna, która sprawnie diagnozuje problemy użytkowników i dba o ich rozwiązanie. Cierpliwa i dokładna.',
    'Communicative person who diagnoses user problems efficiently and sees them through. Patient and thorough.',
  ]),
  s(3, ['Praca zespołowa', 'Командна робота', 'Teamwork'], [
    'Dobrze pracuje w zespole, stosuje dobre praktyki pracy z kodem i chętnie dzieli się wiedzą.',
    'Works well in a team, follows good coding practices and shares knowledge willingly.',
  ]),
  s(4, ['Szukam pierwszej pracy w IT', 'Шукаю першу роботу в ІТ', 'Seeking first IT role'], [
    'Szukam pierwszej pracy w IT. Uczę się systematycznie, buduję własne projekty i szybko przyswajam nowe narzędzia.',
    'Looking for my first IT role. I learn consistently, build my own projects and pick up new tools quickly.',
  ]),
  e(1, ['Tworzenie funkcji', 'Розробка функцій', 'Building features'], [
    'Tworzenie i rozwijanie funkcji aplikacji zgodnie z wymaganiami',
    'Built and extended application features according to requirements',
  ]),
  e(2, ['Testy i poprawki', 'Тести й виправлення', 'Testing and fixes'], [
    'Pisanie testów oraz diagnozowanie i naprawianie błędów',
    'Wrote tests and diagnosed and fixed bugs',
  ]),
  e(3, ['Code review', 'Код-рев’ю', 'Code review'], [
    'Udział w przeglądach kodu i utrzymywanie dobrych praktyk w zespole',
    'Took part in code reviews and kept good practices within the team',
  ]),
  e(4, ['Wsparcie użytkowników', 'Підтримка користувачів', 'User support'], [
    'Wsparcie użytkowników i rozwiązywanie zgłoszeń technicznych',
    'Supported users and resolved technical tickets',
  ]),
  e(5, ['Dokumentacja', 'Документація', 'Documentation'], [
    'Prowadzenie dokumentacji technicznej i opisów zmian',
    'Maintained technical documentation and change notes',
  ]),
  k(1, ['Git', 'Git', 'Git'], [
    'Git, praca z repozytoriami',
    'Git, working with repositories',
  ]),
  k(2, ['Bazy danych', 'Бази даних', 'Databases'], [
    'SQL, bazy danych',
    'SQL, databases',
  ]),
  k(3, ['Testowanie', 'Тестування', 'Testing'], [
    'testy automatyczne, debugowanie',
    'automated testing, debugging',
  ]),
  k(4, ['Metodyki pracy', 'Методики роботи', 'Work methods'], [
    'Agile, Scrum, praca z systemem zgłoszeń',
    'Agile, Scrum, working with ticket systems',
  ]),
];
