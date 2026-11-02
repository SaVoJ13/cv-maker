/**
 * Словник ключових слів для орієнтовної оцінки «CV ↔ оголошення».
 * Сканер шукає в оголошенні ЛИШЕ слова з цього словника, тому загальні слова
 * («praca», «firma», «oferta», «team» тощо) ключовими бути не можуть.
 *
 * Запис = одне поняття. Кожна форма поняття має вигляд `Відображення=шаблон;шаблон`.
 * Шаблон — слова через пробіл у нормалізованому вигляді (малі літери, без діакритики).
 * Закінчення `*` означає «слово починається з…» (польська флексія без бібліотек).
 * Форми різних мов (PL/EN) в одному записі — так змішані оголошення рахуються чесно:
 * «wózek widłowy» в оголошенні збігається з «forklift» у CV, і навпаки.
 */

export type AtsKind = 'hard' | 'soft' | 'requirement';
export type AtsAddTo = 'skillsHard' | 'skillsSoft' | 'summary';

/** Ключове слово у виданому результаті (за планом docs/plan-pro.md). */
export interface AtsKeyword {
  stem: string;
  display: string;
  kind: AtsKind;
  weight: number;
  addTo?: AtsAddTo;
}

export interface Matcher {
  text: string;
  prefix: boolean;
}

export interface AtsForm {
  display: string;
  /** Альтернативні шаблони; кожен — послідовність слів */
  patterns: Matcher[][];
}

export interface AtsEntry {
  stem: string;
  kind: AtsKind;
  weight: number;
  addTo?: AtsAddTo;
  forms: AtsForm[];
}

/** Мінімальна довжина основи в шаблоні з `*`: коротші дають випадкові збіги. */
export const MIN_PREFIX = 4;

/** Нормалізація: малі літери, без діакритики (ł окремо, бо NFD його не розкладає). */
export function normalizeText(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Слова: латиниця й цифри, з хвостом + або # (c++, c#). */
export function tokenize(s: string): string[] {
  return normalizeText(s).match(/[a-z0-9]+(?:[+#]+)?/g) ?? [];
}

function parseMatchers(pat: string): Matcher[] {
  return normalizeText(pat)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.endsWith('*') ? { text: w.slice(0, -1), prefix: true } : { text: w, prefix: false }));
}

function parseForm(raw: string): AtsForm {
  const i = raw.indexOf('=');
  const display = (i < 0 ? raw : raw.slice(0, i)).trim();
  const pats = (i < 0 ? display : raw.slice(i + 1)).split(';');
  return { display, patterns: pats.map(parseMatchers).filter((p) => p.length > 0) };
}

const DEFAULT_WEIGHT: Record<AtsKind, number> = { hard: 3, requirement: 2, soft: 1 };

function entry(kind: AtsKind, forms: string[], weight?: number): AtsEntry {
  const parsed = forms.map(parseForm);
  const first = parsed[0].patterns[0].map((m) => m.text).join(' ');
  return {
    stem: first,
    kind,
    weight: weight ?? DEFAULT_WEIGHT[kind],
    // Вимоги (права, допуски, мови) автоматично в навички не додаємо: це були б твердження про користувача.
    addTo: kind === 'hard' ? 'skillsHard' : kind === 'soft' ? 'skillsSoft' : undefined,
    forms: parsed,
  };
}
const hard = (forms: string[], weight?: number) => entry('hard', forms, weight);
const soft = (forms: string[], weight?: number) => entry('soft', forms, weight);
const req = (forms: string[], weight?: number) => entry('requirement', forms, weight);

/**
 * Загальні слова, які ніколи не можуть бути ключовими (польська й англійська).
 * Використовується для перевірки словника в тестах.
 */
export const GENERIC_WORDS: readonly string[] = [
  'praca', 'pracy', 'prace', 'prace', 'pracownik', 'pracownika', 'firma', 'firmy', 'firmie', 'oferta', 'oferty',
  'oferujemy', 'oferuje', 'doswiadczenie', 'doswiadczenia', 'wymagania', 'wymagamy', 'stanowisko', 'stanowisku',
  'kandydat', 'kandydaci', 'zespol', 'zespole', 'umiejetnosci', 'znajomosc', 'wynagrodzenie', 'benefity',
  'rekrutacja', 'ogloszenie', 'aplikuj', 'aplikacja', 'dzialania', 'zadania', 'obowiazki', 'miejsce',
  'work', 'job', 'jobs', 'company', 'offer', 'experience', 'team', 'role', 'candidate', 'position', 'requirements',
  'skills', 'knowledge', 'salary', 'benefits', 'apply', 'application', 'duties', 'responsibilities', 'location',
  'responsible', 'looking', 'join', 'about', 'working',
];

export const ATS_DICTIONARY: readonly AtsEntry[] = [
  /* ---- Склад і логістика ---- */
  hard(['Wózek widłowy=woze* widlow*;wozk* widlow*', 'Forklift=forklift*']),
  hard(['Kompletacja zamówień=kompletacj*;kompletowa*', 'Order picking=order picking;picking']),
  hard(['WMS=wms']),
  hard(['Obsługa magazynu=magazyn*', 'Warehouse=warehous*'], 2),
  hard(['Skaner kodów kreskowych=skaner*;czytnik* kodow*', 'Barcode scanner=barcode*']),
  hard(['Inwentaryzacja=inwentaryzacj*', 'Stocktaking=stocktak*;inventory']),
  hard(['Pakowanie=pakowa*', 'Packing=packing'], 2),
  hard(['Logistyka=logisty*', 'Logistics=logistics']),
  hard(['Spedycja=spedycj*', 'Freight forwarding=forwarding;freight']),
  hard(['Dokumentacja magazynowa=dokumentacj* magazynow*', 'Warehouse documentation=warehouse documentation']),
  hard(['SAP=sap']),
  hard(['CMR=cmr']),

  /* ---- Водії й транспорт ---- */
  hard(['Tachograf=tachograf*', 'Tachograph=tachograph*']),
  hard(['Czas pracy kierowców=czas* prac* kierowc*', 'Driver working time=driver* working time;driving time']),
  hard(['Transport międzynarodowy=transport* miedzynarodow*', 'International transport=international transport*']),
  hard(['Załadunek i rozładunek=zaladun*;rozladun*', 'Loading and unloading=loading;unloading']),
  hard(['Nawigacja GPS=gps']),
  req(['Prawo jazdy=praw* jazdy', 'Driving licence=driving licence;driving license']),
  req(['Karta kierowcy=kart* kierowcy;kart* tachograf*', 'Driver card=driver card']),
  req(['Kod 95=kod 95', 'Code 95=code 95']),
  req(['ADR=adr']),
  req(['Uprawnienia UDT=udt']),
  req(['Uprawnienia SEP=uprawnieni* sep;kwalifikacj* sep;swiadectw* kwalifikacyjn*;uprawnieni* energetyczn*']),

  /* ---- Будівництво ---- */
  hard(['Rysunki techniczne=rysun* techniczn*', 'Technical drawings=technical drawing*;blueprint*']),
  hard(['Murowanie=murowa*;murarsk*', 'Bricklaying=bricklay*']),
  hard(['Gładzie i szpachlowanie=gladz*;szpachl*', 'Plastering=plastering']),
  hard(['Malowanie=malowa*', 'Painting=painting'], 2),
  hard(['Układanie płytek=uklada* plyt*;uklada* plytek', 'Tiling=tiling']),
  hard(['Szalunki=szalun*', 'Formwork=formwork']),
  hard(['Zbrojenie=zbroj*', 'Reinforcement=rebar;reinforcement']),
  hard(['Instalacje elektryczne=instalacj* elektryczn*', 'Electrical installation=electrical installation*']),
  hard(['Spawanie=spawa*;spawacz*', 'Welding=welding;welder*']),
  hard(['MIG/MAG=mig;mag', 'TIG=tig']),
  req(['Uprawnienia spawalnicze=uprawnieni* spawalnicz*']),
  hard(['BHP=bhp', 'Health and safety=health and safety']),

  /* ---- Виробництво й CNC ---- */
  hard(['CNC=cnc']),
  hard(['Tokarka=tokar*', 'Lathe=lathe']),
  hard(['Frezarka=frezar*;frezowa*', 'Milling=milling']),
  hard(['Operator maszyn=operator* maszyn*', 'Machine operator=machine operator*']),
  hard(['Narzędzia pomiarowe=narzedz* pomiarow*;suwmiark*;mikrometr*', 'Measuring tools=measuring tool*;calliper*;caliper*']),
  hard(['Kontrola jakości=kontrol* jakosci', 'Quality control=quality control;quality assurance']),
  hard(['ISO 9001=iso 9001']),
  hard(['Lean=lean;kaizen', '5S=5s']),
  hard(['Montaż=montaz*', 'Assembly=assembly']),
  hard(['Linia produkcyjna=lini* produkcyjn*', 'Production line=production line*']),
  hard(['AutoCAD=autocad']),
  hard(['SolidWorks=solidworks']),

  /* ---- IT ---- */
  hard(['JavaScript=javascript']),
  hard(['TypeScript=typescript']),
  hard(['Python=python']),
  hard(['Java=java']),
  hard(['C#=c#']),
  hard(['C++=c++']),
  hard(['.NET=dotnet;net core;asp net;net framework']),
  hard(['PHP=php']),
  hard(['SQL=sql']),
  hard(['PostgreSQL=postgresql;postgres']),
  hard(['MySQL=mysql']),
  hard(['MongoDB=mongodb']),
  hard(['React=react']),
  hard(['Angular=angular*']),
  hard(['Vue=vue;vuejs']),
  hard(['Node.js=node js;nodejs']),
  hard(['HTML=html']),
  hard(['CSS=css']),
  hard(['Docker=docker']),
  hard(['Kubernetes=kubernetes;k8s']),
  hard(['Git=git']),
  hard(['Linux=linux']),
  hard(['AWS=aws']),
  hard(['Azure=azure']),
  hard(['REST API=rest api;restful;api'], 2),
  hard(['CI/CD=ci cd;cicd']),
  hard(['Jira=jira']),
  hard(['Scrum=scrum']),
  hard(['Agile=agile;zwinn*'], 2),
  hard(['Testy automatyczne=test* automatyczn*', 'Automated testing=automated test*;test automation']),
  hard(['Helpdesk=helpdesk;help desk']),
  hard(['Active Directory=active directory']),
  hard(['Sieci komputerowe=siec* komputerow*;tcp ip', 'Networking=networking']),

  /* ---- Офіс ---- */
  hard(['MS Office=ms office;microsoft office;pakiet office;office 365;microsoft 365']),
  hard(['Excel=excel*']),
  hard(['Outlook=outlook']),
  hard(['PowerPoint=powerpoint']),
  hard(['Obsługa klienta=obslug* klient*', 'Customer service=customer service;customer support']),
  hard(['Korespondencja=korespondencj*', 'Correspondence=correspondence'], 2),
  hard(['Fakturowanie=fakturowa*;faktur*', 'Invoicing=invoicing;invoices']),
  hard(['Księgowość=ksiegow*', 'Accounting=accounting;bookkeeping']),
  hard(['Kadry i płace=kadr* i plac*;kadr* plac*', 'Payroll=payroll']),
  hard(['Archiwizacja=archiwizacj*']),
  hard(['Sekretariat=sekretariat*', 'Secretarial=secretarial']),
  hard(['CRM=crm']),
  hard(['ERP=erp;comarch']),

  /* ---- Торгівля й гастрономія ---- */
  hard(['Obsługa kasy fiskalnej=fiskaln*;obslug* kasy', 'Cash register=cash register;cash handling']),
  hard(['Ekspozycja towaru=ekspozycj* towar*;wyklad* towar*', 'Merchandising=merchandising']),
  hard(['Sprzedaż=sprzedaz*;sprzedaw*', 'Sales=sales'], 2),
  hard(['Barista=barist*']),
  hard(['Kelner=kelner*', 'Waiter=waiter*;waitress*']),
  hard(['Obsługa gości=obslug* gosci', 'Guest service=guest service']),
  hard(['Higiena=higien*', 'Hygiene=hygiene'], 2),
  req(['HACCP=haccp']),
  req(['Książeczka sanepidowska=ksiazeczk* sanepidowsk*;sanepid*']),

  /* ---- Студенти ---- */
  hard(['Staż i praktyki=staz*;praktyk*', 'Internship=internship*'], 2),

  /* ---- М'які навички ---- */
  soft(['Praca w zespole=prac* w zespol*;prac* zespolow*;wspolprac* w zespol*', 'Teamwork=teamwork;team player;work in a team;working in a team']),
  soft(['Komunikatywność=komunikatywn*;komunikacj*', 'Communication skills=communication*']),
  soft(['Samodzielność=samodzielnos*;samodzieln*', 'Independence=independent*;self motivated;autonomous']),
  soft(['Dokładność=dokladnos*;dokladn*', 'Attention to detail=attention to detail;detail oriented']),
  soft(['Punktualność=punktualn*', 'Punctuality=punctual*']),
  soft(['Zarządzanie czasem=zarzadzan* czasem;organizacj* czasu;organizacj* pracy', 'Time management=time management;organisational;organizational']),
  soft(['Odporność na stres=odpornos* na stres;stresoodporn*', 'Stress resistance=stress resistant;stress resilience;under pressure']),
  soft(['Elastyczność=elastycznos*;elastyczn*', 'Flexibility=flexib*']),
  soft(['Rozwiązywanie problemów=rozwiazywan* problem*', 'Problem solving=problem solving;problem solver*']),
  soft(['Zaangażowanie=zaangazowan*', 'Commitment=committed;commitment']),
  soft(['Chęć do nauki=chec* do nauki;chec* nauki;szybk* uczeni*;szybka nauka;szybko sie uczy', 'Willingness to learn=willingness to learn;quick learner;fast learner;eager to learn']),

  /* ---- Вимоги ---- */
  req(['Dyspozycyjność=dyspozycyjn*', 'Availability=availability']),
  req(['Praca zmianowa=zmianow*;prac* na zmiany;system* zmianow*', 'Shift work=shift work;shifts']),
  req(['Język angielski=jezyk* angielsk*;angielsk*;znajomosc* angielskiego', 'English=english']),
  req(['Język niemiecki=jezyk* niemieck*;niemieck*', 'German=german']),
  req(['Język ukraiński=jezyk* ukrainsk*;ukrainsk*', 'Ukrainian=ukrainian']),
  req(['Język rosyjski=jezyk* rosyjsk*;rosyjsk*', 'Russian=russian']),
  req(['Język polski=jezyk* polsk*', 'Polish=polish']),
  req(['Wykształcenie wyższe=wyksztalcen* wyzsz*', 'Higher education=higher education;university degree;bachelor*;master degree']),
  req(['Wykształcenie średnie / zawodowe=wyksztalcen* srednie*;wyksztalcen* zawodow*', 'Secondary education=secondary education;vocational']),
  req(['Orzeczenie lekarskie=orzeczen* lekarsk*;badani* lekarsk*', 'Medical certificate=medical certificate;medical examination']),
];

/** Перевірка словника: повертає список проблем (порожній = усе гаразд). */
export function validateDictionary(dict: readonly AtsEntry[] = ATS_DICTIONARY): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const e of dict) {
    if (ids.has(e.stem)) problems.push(`дубль поняття: ${e.stem}`);
    ids.add(e.stem);
    if (e.forms.length === 0) problems.push(`${e.stem}: немає форм`);
    if (e.kind === 'requirement' && e.addTo) problems.push(`${e.stem}: вимогу не можна додавати в навички автоматично`);
    for (const f of e.forms) {
      if (!f.display) problems.push(`${e.stem}: порожнє відображення`);
      if (f.patterns.length === 0) problems.push(`${e.stem}/${f.display}: немає шаблонів`);
      for (const p of f.patterns) {
        for (const m of p) {
          if (m.prefix && m.text.length < MIN_PREFIX) problems.push(`${e.stem}/${f.display}: надто коротка основа «${m.text}*»`);
        }
        if (p.length === 1) {
          const m = p[0];
          for (const g of GENERIC_WORDS) {
            if (m.prefix ? g.startsWith(m.text) : g === m.text) problems.push(`${e.stem}/${f.display}: загальне слово «${g}» як ключове`);
          }
        }
      }
    }
  }
  return problems;
}
