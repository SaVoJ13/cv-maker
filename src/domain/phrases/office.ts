import { group } from './make';

const s = group('office', 'summary');
const e = group('office', 'experience');
const k = group('office', 'skills');

export const OFFICE = [
  s(1, ['Pracownik biurowy', 'Офісний працівник', 'Office worker'], [
    'Osoba zorganizowana, dbająca o terminowość, dokładność i dobrą komunikację. Sprawnie obsługuje dokumenty i pocztę.',
    'Organised office worker who values punctuality, accuracy and good communication. Handles documents and email efficiently.',
  ]),
  s(2, ['Asystent / sekretariat', 'Асистент / секретаріат', 'Assistant / secretary'], [
    'Doświadczenie w organizacji pracy biura i wsparciu przełożonych. Dyskrecja, komunikatywność i rzetelność.',
    'Assistant with experience organising office work and supporting managers. Discreet, communicative and reliable.',
  ]),
  s(3, ['Obsługa klienta', 'Обслуговування клієнтів', 'Customer service'], [
    'Osoba życzliwa i cierpliwa w kontakcie z klientem. Potrafi rozwiązywać problemy i dbać o dobre relacje.',
    'Friendly and patient with customers. Able to solve problems and maintain good relationships.',
  ]),
  s(4, ['Szukam pracy biurowej', 'Шукаю офісну роботу', 'Seeking office role'], [
    'Szukam pracy biurowej. Cechuje mnie dokładność, sumienność i szybkie uczenie się nowych programów oraz procedur.',
    'Looking for an office position. I am precise, conscientious and quick to learn new software and procedures.',
  ]),
  e(1, ['Dokumenty i korespondencja', 'Документи і листування', 'Documents and correspondence'], [
    'Przygotowywanie dokumentów, korespondencji i archiwizacja',
    'Prepared documents and correspondence and handled filing',
  ]),
  e(2, ['Obsługa klienta', 'Робота з клієнтами', 'Customer handling'], [
    'Obsługa klientów telefoniczna, mailowa i osobista',
    'Handled customers by phone, email and in person',
  ]),
  e(3, ['Kalendarz i spotkania', 'Календар і зустрічі', 'Calendar and meetings'], [
    'Organizacja spotkań, kalendarza i podróży służbowych',
    'Organised meetings, calendars and business travel',
  ]),
  e(4, ['Dane w systemie', 'Дані в системі', 'Data entry'], [
    'Wprowadzanie i aktualizacja danych w systemach firmy',
    'Entered and updated data in company systems',
  ]),
  e(5, ['Faktury i zamówienia', 'Рахунки та замовлення', 'Invoices and orders'], [
    'Obsługa zamówień i wstępna weryfikacja faktur',
    'Processed orders and carried out initial invoice checks',
  ]),
  k(1, ['Pakiet biurowy', 'Офісні програми', 'Office suite'], [
    'MS Office, Excel, Word, Outlook',
    'MS Office, Excel, Word, Outlook',
  ]),
  k(2, ['Organizacja pracy', 'Організація роботи', 'Work organisation'], [
    'organizacja pracy, zarządzanie czasem',
    'work organisation, time management',
  ]),
  k(3, ['Obsługa dokumentów', 'Робота з документами', 'Document handling'], [
    'obsługa dokumentów, archiwizacja',
    'document handling, filing',
  ]),
  k(4, ['Komunikacja', 'Комунікація', 'Communication'], [
    'komunikacja z klientem, korespondencja biznesowa',
    'customer communication, business correspondence',
  ]),
];
