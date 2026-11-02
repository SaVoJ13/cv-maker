import { group } from './make';

const s = group('drivers', 'summary');
const e = group('drivers', 'experience');
const k = group('drivers', 'skills');

export const DRIVERS = [
  s(1, ['Kierowca zawodowy', 'Водій-професіонал', 'Professional driver'], [
    'Osoba odpowiedzialna, dbająca o bezpieczeństwo, punktualność i dobry stan pojazdu. Zna zasady pracy w transporcie i dobrze organizuje trasę.',
    'Responsible driver who cares about safety, punctuality and vehicle condition. Familiar with transport work rules and plans routes well.',
  ]),
  s(2, ['Transport krajowy i międzynarodowy', 'Перевезення по країні й за кордон', 'Domestic and international transport'], [
    'Gotowość do pracy w transporcie krajowym i międzynarodowym. Samodzielność, komunikatywność i dobre radzenie sobie na długich trasach.',
    'Driver ready for domestic and international transport. Independent, communicative and comfortable with long routes.',
  ]),
  s(3, ['Kierowca dostawczy', 'Водій на доставці', 'Delivery driver'], [
    'Nastawienie na terminowe dostawy i dobry kontakt z klientem. Dokładność w pracy z dokumentami przewozowymi.',
    'Driver focused on on-time deliveries and good customer contact. Careful with transport documents.',
  ]),
  s(4, ['Szukam pracy jako kierowca', 'Шукаю роботу водія', 'Seeking driver role'], [
    'Szukam pracy kierowcy. Cechuje mnie punktualność, dyscyplina i gotowość do pracy w systemie zmianowym lub w trasie.',
    'Looking for a driver position. I am punctual, disciplined and ready to work shifts or on the road.',
  ]),
  e(1, ['Przewóz towarów', 'Перевезення вантажів', 'Freight transport'], [
    'Przewóz towarów zgodnie z harmonogramem i dokumentami przewozowymi',
    'Transported goods according to schedule and transport documents',
  ]),
  e(2, ['Planowanie trasy', 'Планування маршруту', 'Route planning'], [
    'Planowanie trasy z uwzględnieniem czasu pracy i warunków na drodze',
    'Planned routes taking working time and road conditions into account',
  ]),
  e(3, ['Kontakt z klientem', 'Контакт із клієнтом', 'Customer contact'], [
    'Kontakt z klientami i nadawcami przy załadunku oraz rozładunku',
    'Liaised with customers and shippers during loading and unloading',
  ]),
  e(4, ['Stan pojazdu', 'Стан автомобіля', 'Vehicle condition'], [
    'Codzienna kontrola stanu technicznego pojazdu przed wyjazdem',
    'Checked the technical condition of the vehicle daily before departure',
  ]),
  e(5, ['Dokumentacja', 'Документація', 'Documentation'], [
    'Prowadzenie dokumentacji przewozowej i rozliczanie czasu pracy',
    'Kept transport documents and recorded working time',
  ]),
  k(1, ['Bezpieczna jazda', 'Безпечне водіння', 'Safe driving'], [
    'bezpieczna jazda, znajomość przepisów drogowych',
    'safe driving, knowledge of road regulations',
  ]),
  k(2, ['Czas pracy kierowcy', 'Час роботи водія', 'Driver working time'], [
    'przepisy o czasie pracy kierowców, obsługa tachografu',
    'driver working time rules, tachograph use',
  ]),
  k(3, ['Nawigacja i trasy', 'Навігація і маршрути', 'Navigation and routes'], [
    'nawigacja GPS, planowanie tras',
    'GPS navigation, route planning',
  ]),
  k(4, ['Załadunek i zabezpieczenie', 'Завантаження і кріплення', 'Loading and securing'], [
    'załadunek i rozładunek, zabezpieczanie ładunku',
    'loading and unloading, load securing',
  ]),
];
