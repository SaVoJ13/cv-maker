# CV Maker: правила роботи для Claude Code

Генератор CV під ринок праці Польщі та ЄС. Web (React 19 + Vite 7 + TypeScript strict) і Android (Capacitor 8).
Пакет Android: `com.savoj13.freecv` (після публікації змінити НЕ можна). Назва: «CV Maker».

## Мова
- Спілкуйся з власником виключно українською.
- Коментарі в коді та документацію пиши українською.
- Тексти інтерфейсу: PL / UA (код `uk`) / EN. Тексти документа CV: польська та англійська.
- Власник не програміст: давай прості пояснення і чіткі кроки для Windows + PowerShell.

## Команди
- `npm test` — швидкі тести (`tests/*.test.ts`: domain, словники, нормалізація, QR-матриця); запускай під час роботи
- `npm run test:slow` — повільні тести (`tests/*.slow.ts`: справжня розкладка pdfmake, розриви сторінок, галерея, PDF з QR)
- `npm run test:all` — обидва набори; **обов'язково перед кожним комітом кроку й перед пушем**
- `npm run build` — перевірка типів + збірка
- `npm run android:sync` — збірка веб-частини, `cap sync`, встановлення нативного плагіна
- `npm run check:prod` — збирає профілі closed і production, шукає в них заглушки/кнопку розробника й перевіряє конфігурацію монетизації; **код 1 = збірка не готова до публікації** (production провалюється, поки `testAds: true`; перед релізом у магазин має проходити)
- `npm run check:closed` — після `android:sync:closed`: перевіряє профіль closed і файли, що справді підуть в Android (assets/public); докладна інструкція зі збірки .aab — `docs/closed-test-release.md`
- `npm run android:sync:dev` / `android:sync:closed` / `android:sync` — збірка для Android у профілі dev / closed / production
- `npm run android:icons` — іконки з `assets/`

## Архітектура
- Уся чиста логіка лежить у `src/domain/` і не імпортує React чи API браузера.
- Кожен новий модуль у `src/domain/` має тест у `tests/*.test.ts`.
- Жодних серверів, хмарних БД і платних API: усе працює локально на пристрої.
- Стан: власний reducer у `src/store/`, `localStorage` (ключ `cvmaker.state`), доступ/PRO у окремому ключі `cvmaker.access`.
- PRO-статус НІКОЛИ не потрапляє в файл резервної копії.
- Зворотна сумісність: старі CV та бекапи мають мігрувати без втрати даних (див. `docs/plan-pro.md`).
- Нативний код живе в `native/*.tpl`, у `android/` його ставить `scripts/install-native.mjs`.
- Шрифти тільки локальні (`@fontsource/*`), жодних запитів до Google Fonts.

## Профілі збірки (Vite --mode)
- **dev** (`build:dev`, `npm run dev`): заглушка billing, симулятор реклам (лише `npm run dev`), кнопка «Resetuj Pass i reklamy»; для перевірки на телефоні.
- **closed** (`build:closed`): закритий тест у Google Play; справжній Billing (з 5b), `testAds: true` дозволено; жодних заглушок.
- **production** (`npm run build`, `android:sync`): випуск; `testAds: false`, жодних заглушок. Правила профілів — у `src/monetization/profile.ts`, перевіряє `check:prod`.

## Безпека (суворо)
- Ніколи не додавай у git ключ підпису (`*.jks`, `*.keystore`), `keystore.properties`, `*.aab`, `*.apk`.
- Ключ підпису лежить поза проєктом: `C:\Users\cocro\keystores\freecv.jks`. Не змінюй і не переміщуй його.
- `testAds: true` у `src/monetization/config.ts` лишається до фінальної збірки для магазину.
- Тестові режими й заглушки покупок не повинні потрапляти в production-збірку.
- `android_old/` у git не відстежується, не чіпай його.

## Процес
- Працюй за `docs/plan-pro.md`, по одному спринту; перед початком кожного спринту коротко узгодь обсяг із власником.
- Малі коміти зі змістовними повідомленнями українською після кожного завершеного кроку.
- Перед комітом кроку та перед пушем: `npm run test:all` і `npm run build` мають проходити. Під час роботи достатньо `npm test`.
- Не змінюй `appId`, не видаляй наявні дані користувача, не роби `git push --force`.
