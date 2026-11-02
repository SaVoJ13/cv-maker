import { group } from './make';

const s = group('logistics', 'summary');
const e = group('logistics', 'experience');
const k = group('logistics', 'skills');

export const LOGISTICS = [
  s(1, ['Pracownik magazynu', 'Працівник складу', 'Warehouse worker'], [
    'Rzetelny pracownik magazynu, który dba o porządek, dokładność i terminowe wykonywanie zadań. Dobrze pracuje w zespole i szybko uczy się nowych procedur.',
    'Reliable warehouse worker who values order, accuracy and meeting deadlines. Works well in a team and learns new procedures quickly.',
  ]),
  s(2, ['Kompletacja zamówień', 'Комплектація замовлень', 'Order picking'], [
    'Doświadczenie w kompletacji zamówień i pracy z dokumentacją magazynową. Skupiony na jakości, bezpieczeństwie i dokładności.',
    'Experience in order picking and handling warehouse documentation. Focused on quality, safety and accuracy.',
  ]),
  s(3, ['Koordynator logistyki', 'Координатор логістики', 'Logistics coordinator'], [
    'Osoba zorganizowana, nastawiona na sprawny przepływ towarów i dobrą komunikację z dostawcami oraz przewoźnikami. Potrafi pracować pod presją czasu.',
    'Organised professional focused on smooth goods flow and good communication with suppliers and carriers. Able to work under time pressure.',
  ]),
  s(4, ['Szukam pracy w magazynie', 'Шукаю роботу на складі', 'Seeking warehouse role'], [
    'Szukam pracy w magazynie lub logistyce. Jestem odpowiedzialny, punktualny i gotowy do pracy zmianowej.',
    'Looking for a role in a warehouse or logistics. I am responsible, punctual and ready for shift work.',
  ]),
  e(1, ['Kompletacja i pakowanie', 'Комплектація і пакування', 'Picking and packing'], [
    'Kompletowanie i pakowanie zamówień zgodnie z dokumentacją',
    'Picked and packed orders according to documentation',
  ]),
  e(2, ['Przyjęcie i wydanie towaru', 'Приймання і видача товару', 'Goods in and out'], [
    'Przyjmowanie dostaw, kontrola zgodności towaru z dokumentami i wydawanie towaru',
    'Received deliveries, checked goods against documents and dispatched goods',
  ]),
  e(3, ['Obsługa systemu WMS', 'Робота із системою WMS', 'WMS system use'], [
    'Obsługa systemu magazynowego (WMS) i skanera kodów kreskowych',
    'Used the warehouse management system (WMS) and barcode scanner',
  ]),
  e(4, ['Inwentaryzacja', 'Інвентаризація', 'Stocktaking'], [
    'Udział w inwentaryzacji i dbanie o zgodność stanów magazynowych',
    'Took part in stocktaking and kept stock levels accurate',
  ]),
  e(5, ['Porządek i BHP', 'Порядок і охорона праці', 'Order and safety'], [
    'Utrzymywanie porządku na stanowisku pracy i przestrzeganie zasad BHP',
    'Kept the workstation tidy and followed health and safety rules',
  ]),
  k(1, ['Obsługa magazynu', 'Робота на складі', 'Warehouse operations'], [
    'obsługa magazynu, kompletacja zamówień',
    'warehouse operations, order picking',
  ]),
  k(2, ['Dokumentacja magazynowa', 'Складська документація', 'Warehouse documents'], [
    'dokumentacja magazynowa, przyjęcia i wydania towaru',
    'warehouse documentation, goods receipt and dispatch',
  ]),
  k(3, ['WMS i skaner', 'WMS і сканер', 'WMS and scanner'], [
    'systemy WMS, skaner kodów kreskowych',
    'WMS systems, barcode scanner',
  ]),
  k(4, ['Planowanie i organizacja', 'Планування й організація', 'Planning and organisation'], [
    'planowanie dostaw, organizacja pracy',
    'delivery planning, work organisation',
  ]),
];
