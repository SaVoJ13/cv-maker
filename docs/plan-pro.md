# План: Free + PRO, три мови, галузеві шаблони, офлайн-інструменти

Статус: затверджено власником 2026-11-01 (етап 1). Зміни вносити тільки за згодою власника.

## Рішення власника
1. Безкоштовні шаблони (4): `classic`, `minimal`, `ats`, `industrial`. Решта поточних (`modern`, `executive`, `creative`, `technical`, `panel`, `elegant`, `bold`, `nordic`) і всі нові шаблони = PRO.
2. Новий шаблон «Inżynier / Fachowiec» робимо окремим макетом із блоком допусків і сертифікатів. `industrial` лишається безкоштовним.
3. Порядок із Google Play: спершу закрите тестування з поточною стабільною збіркою (старт відліку 14 днів), PRO розробляємо паралельно і випускаємо оновленням.
4. Реклама: поки що PDF доступний тільки після перегляду реклами, запасного шляху немає. Чи буде реклама в базовій версії, ще не вирішено, тому `MONETIZATION.adsEnabled` має працювати як головний вимикач: реклама вимкнена означає, що всі функції без реклами доступні як зараз.

## Структура `src/`
```
domain/
  types.ts           UiLang, DocLang, CvExtras, photoShape
  schema.ts          CURRENT_SCHEMA = 2, migrate()
  features.ts        матриця FeatureId -> tier, ліміти Free
  access.ts          ProState, токени, decideExport/decideFeature
  templates.ts       шаблони + tier + галузь (виносимо з constants.ts)
  phrases/           types.ts, index.ts, 8 файлів по галузях
  atsScanner.ts      + atsDictionary.ts
  qr.ts              чиста QR-матриця
  autoFit.ts
  coverLetter.ts     + coverLetterTemplates.ts
  quality.ts         розширено порадами рекрутера
  pdf/               розбито з pdf.ts
  i18n/              pl.ts, uk.ts, en.ts
export/              + coverLetterPdf.ts
monetization/        + billing.ts (обгортка Google Play Billing, поза domain)
tests/               тест на кожен новий модуль domain/
```

## Ключові типи
```ts
export type UiLang = 'pl' | 'uk' | 'en';
export type DocLang = 'pl' | 'en';
export type Tier = 'free' | 'pro';
export type FeatureId =
  | 'tpl_pro' | 'accent_extra' | 'photo_shape' | 'autofit' | 'qr'
  | 'phrases' | 'ats_scan' | 'cover_letter' | 'no_ads';

/** Окремий ключ cvmaker.access. НІКОЛИ не входить у бекап. */
export interface ProState {
  v: 2;
  pro: boolean;
  proVerifiedAt: number | null;
  credits: number;
  unlocks: UnlockToken[];
}
export interface UnlockToken {
  feature: FeatureId;
  cvId?: string;
  uses: number | null;      // 1 = разовий
  expiresAt: number | null; // для інструментів, напр. 30 хв
}

export interface CvExtras {
  driver?: { categories: string[]; code95: boolean; tachograph: boolean;
             adr: boolean; udt: boolean; fleet: string; routes: ('PL' | 'UE')[] };
  tech?: { sep: string; welding: string[]; cnc: string;
           drawings: boolean; bhp: boolean; certs: string[] };
  qr?: { enabled: boolean; url: string; label: string };
}
// Basics + photoShape: 'square' | 'rounded' | 'circle'
// Cv + autoFit: boolean;  CvData + extras: CvExtras

export type IndustryId = 'logistics' | 'drivers' | 'construction' | 'production_cnc'
  | 'it' | 'office' | 'retail_food' | 'students';
export interface Phrase {
  id: string; industry: IndustryId;
  section: 'summary' | 'experience' | 'skills';
  title: Record<UiLang, string>;
  text: Record<DocLang, string>;
}

export interface AtsKeyword { stem: string; display: string;
  kind: 'hard' | 'soft' | 'requirement'; weight: number;
  addTo?: 'skillsHard' | 'skillsSoft' | 'summary' }
export interface AtsScanResult { score: number; matched: AtsKeyword[];
  missing: AtsKeyword[]; jobLang: 'pl' | 'en' | 'mixed'; hints: string[] }

export interface CoverLetter {
  id: string; cvId: string;  // шапка, контакти, колір, RODO беруться з CV під час рендеру
  name: string; updated: number; lang: DocLang; templateId: string;
  company: string; position: string; recipient: string; body: string;
}

export interface PersistedState {  // ключ cvmaker.state
  schema: 2; cvs: Cv[]; letters: CoverLetter[]; ui: UiLang; currentId: string | null;
}
```

## Міграція
- Без поля `schema` це v1: читаємо як раніше, `normalizeCv` додає нові поля зі значеннями за замовчуванням.
- Перед першим записом у v2 один раз зберігаємо сирий знімок v1 (якщо не вистачає місця, пропускаємо без помилки).
- `portrait` -> `nordic` працює як зараз.
- Бекап: `BACKUP_VERSION` 1 -> 2 (додаються листи). v1 читаємо, v2 пишемо. `BACKUP_APP` не змінюємо.
- Ліміт Free «2 CV»: старі понад ліміт лишаються доступними, нові створити/дублювати не можна. Приклад у ліміт не входить.
- CV, що вже лежать у PRO-шаблонах, редагувати можна. Paywall спрацьовує тільки при експорті PDF.

## Спринти (кожен закінчується робочою збіркою)
| № | Зміст |
|---|---|
| 0 | Репозиторій GitHub і мітка `v1.0-baseline` (ГОТОВО) |
| 1 | Ядро: `schema` + міграції, `UiLang/DocLang`, словник `uk`, перемикач PL/UA/EN, `features.ts`, `access.ts` v2, `templates.ts` (ГОТОВО, перевірено на телефоні) |
| 2 | `phrases` (8 галузей), `atsScanner`, поради рекрутера + UI (ГОТОВО 2026-11-02, див. підсумок нижче) |
| 3 | Шаблони «Kierowca», «Fachowiec», «Student», `extras`, форма фото, палітра, QR, Auto-Fit |
| 4 | Супровідний лист: сутність, 6-8 шаблонів PL/EN, прев'ю A4, PDF, бекап v2 |
| 5 | PRO-UX: paywall при експорті, micro-unlock, Google Play Billing, декларації Play, реліз |

## Підсумок Спринту 2 (2026-11-02)
Зроблено в 8 комітах (кроки 1-6, окремий коміт зі зміною польських текстів, вставка фраз у двох комітах); на момент завершення `npm test` (116 тестів) і `npm run build` проходять.

**Фрази (`src/domain/phrases/`)**
- 104 фрази: 8 галузей × (4 summary + 5 experience + 4 skills). Файли `make.ts` (конструктор), `insert.ts` (правила вставки), `index.ts`, `types.ts`, 8 файлів галузей.
- Правила вставки: summary додається новим абзацом у кінець; experience по одному пункту на рядок; skills через кому без дублікатів; повторна вставка тексту не змінює.
- Фрази нейтральні: без цифр і тверджень про сертифікати, права, допуски (автотест). Польські summary без чоловічих форм (автотест на відсутність «Jestem»).
- UI: кнопка «Wstaw frazę» (`PhrasePicker.tsx`) біля summary, пунктів досвіду і обох полів навичок. Обмежень Free/PRO немає.

**ATS-сканер (`atsDictionary.ts`, `atsScanner.ts`)**
- Словник ~130 понять; шукаються лише слова зі словника, тому загальні слова («praca», «firma», «oferta», «team») ключовими бути не можуть (список `GENERIC_WORDS` + `validateDictionary()` у тесті).
- Кожне поняття має форми PL і EN: змішані оголошення рахуються чесно, збіг працює між мовами.
- Відхилення від початкових типів: `AtsScanResult.hints` повертає коди (`AtsHint`), тексти лежать у словниках інтерфейсу. Вимоги (`requirement`: права, допуски, мови) не мають `addTo` і не додаються в навички автоматично.
- Оцінка = частка ваги знайдених слів; повторюване в оголошенні слово важить на 1 більше. Це «орієнтовна оцінка», не гарантія проходження ATS.
- UI: екран «Dopasuj do oferty» (`AtsMatch.tsx`) відкривається з вкладки «Wygląd» поряд із перевіркою якості. Текст оголошення лишається лише в пам'яті. Оцінка зафіксована вгорі екрана, кнопки «+» мають 44 px, вимоги показані окремим списком без «+».

**Поради рекрутера (`quality.ts`, `RecruiterTips.tsx`)**
- `recruiterTips(cv)`: підказка про код країни тільки коли його немає (будь-який `+<код>` або `00<код>` нормальний); перелік місць у досвіді без жодної цифри (без вигадування чисел, доповнює `ck_metrics`); довідка про art. 22¹ KP завжди з підписом «не юридична порада».
- Тексти PL/UA/EN у словниках.

**Перевірено**
- Тести всіх нових модулів domain; вигляд екранів «Dopasuj do oferty» і порад на екрані 360 px у Chromium (Playwright), без горизонтального переповнення й без запитів назовні.

**Лишилось / на що звернути увагу**
- Польські тексти фраз і порад писав Claude: потрібен перегляд носієм польської.
- Екрани ще не перевірені на реальному телефоні; UA/EN-варіанти екрана ATS не оглядалися візуально.
- У `features.ts` функції `phrases` і `ats_scan` лишаються з рівнем `pro`, але UI їх не обмежує: за рішенням власника фрази й ATS без обмежень до Спринту 5. Рівень і paywall остаточно вирішуємо в Спринті 5.
- Сканер не бачить слів поза словником і не розуміє оголошень українською. Словник можна розширювати окремим кроком.
- `android/build.gradle` має стару незакомічену зміну, до Спринту 2 вона не належить.

## Ризики
- Billing залежить від акаунта Google Play: до цього в Спринтах 1-4 працює заглушка, якої не буде в production.
- Перевірка PRO без сервера обходиться на root-пристроях. Звіряємо з Google Play при старті, кешуємо результат.
- Польська основа слів без бібліотеки: сканер дає орієнтовну оцінку і так підписується (без обіцянки «пройде ATS»).
- QR-генератор пишемо самі, перевіряємо еталонними матрицями та розкодуванням у тестах.
- Auto-Fit: домен лишається чистим, функція приймає колбек `measure(scale) -> pages`.
- Фрази (~150 формулювань PL/EN): бажано перегляд носієм польської.
- Після Спринту 5 у лістингу Play вказати внутрішньоаплікаційні покупки та рекламу.
