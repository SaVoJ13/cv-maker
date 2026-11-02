import { group } from './make';

const s = group('retail_food', 'summary');
const e = group('retail_food', 'experience');
const k = group('retail_food', 'skills');

export const RETAIL_FOOD = [
  s(1, ['Sprzedawca', 'Продавець', 'Sales assistant'], [
    'Uprzejmy sprzedawca, który dba o zadowolenie klientów i estetykę stanowiska. Szybko się uczy i dobrze pracuje w zespole.',
    'Courteous sales assistant who cares about customer satisfaction and a tidy sales area. Learns quickly and works well in a team.',
  ]),
  s(2, ['Kelner / barista', 'Офіціант / бариста', 'Waiter / barista'], [
    'Komunikatywna osoba z doświadczeniem w obsłudze gości. Radzi sobie w ruchu i dba o miłą atmosferę.',
    'Communicative person with guest service experience. Copes well when busy and keeps a pleasant atmosphere.',
  ]),
  s(3, ['Kucharz / kuchnia', 'Кухар / кухня', 'Cook / kitchen'], [
    'Zaangażowana osoba pracująca w kuchni, dbająca o higienę, jakość potraw i sprawną pracę zespołu.',
    'Dedicated kitchen worker who cares about hygiene, food quality and a smooth team workflow.',
  ]),
  s(4, ['Szukam pracy w handlu', 'Шукаю роботу в торгівлі', 'Seeking retail role'], [
    'Szukam pracy w handlu lub gastronomii. Jestem uśmiechnięty, punktualny i gotowy do pracy zmianowej.',
    'Looking for a job in retail or hospitality. I am friendly, punctual and ready for shift work.',
  ]),
  e(1, ['Obsługa klienta', 'Обслуговування клієнтів', 'Customer service'], [
    'Obsługa klientów i doradztwo przy wyborze produktów',
    'Served customers and advised them on product choice',
  ]),
  e(2, ['Kasa', 'Каса', 'Till'], [
    'Obsługa kasy fiskalnej i terminala płatniczego',
    'Operated the till and card payment terminal',
  ]),
  e(3, ['Wykładanie towaru', 'Викладка товару', 'Stocking shelves'], [
    'Przyjmowanie dostaw, wykładanie towaru i dbanie o ekspozycję',
    'Received deliveries, stocked shelves and kept displays tidy',
  ]),
  e(4, ['Higiena i czystość', 'Гігієна і чистота', 'Hygiene and cleanliness'], [
    'Dbanie o czystość stanowiska pracy i przestrzeganie zasad higieny',
    'Kept the workstation clean and followed hygiene rules',
  ]),
  e(5, ['Obsługa gości', 'Обслуговування гостей', 'Guest service'], [
    'Przyjmowanie zamówień, serwowanie dań i napojów',
    'Took orders and served food and drinks',
  ]),
  k(1, ['Obsługa klienta', 'Робота з клієнтами', 'Customer service'], [
    'obsługa klienta, doradztwo',
    'customer service, product advice',
  ]),
  k(2, ['Kasa i płatności', 'Каса і платежі', 'Till and payments'], [
    'obsługa kasy fiskalnej, płatności kartą',
    'till operation, card payments',
  ]),
  k(3, ['Higiena', 'Гігієна', 'Hygiene'], [
    'zasady higieny, dbanie o czystość',
    'hygiene rules, keeping the area clean',
  ]),
  k(4, ['Praca w zespole', 'Робота в команді', 'Teamwork'], [
    'praca w zespole, odporność na stres',
    'teamwork, stress resilience',
  ]),
];
