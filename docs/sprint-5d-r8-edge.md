# Спринт 5d: R8 і edge-to-edge (Android 15+)

## Що змінено
**R8 (мінімізація, обфускація, стиснення ресурсів) для release**
- `native/proguard-rules.pro.tpl` — шаблон keep-правил (Capacitor, наш `SaveFilePlugin`, `MainActivity`, AdMob, native-purchases, `@JavascriptInterface`, номери рядків для звітів про збої).
- `scripts/install-native.mjs` (запускається в кожному `android:sync*`) записує з шаблону `android/app/proguard-rules.pro` і через `scripts/gradle-patch.mjs` вмикає `minifyEnabled true` + `shrinkResources true` у `android/app/build.gradle`. Тобто після `npx cap add android` / регенерації налаштування повертаються самі; вручну згенеровані файли правити не треба (правки зникнуть: міняйте шаблон).
- Бібліотеки (admob, native-purchases, Google Mobile Ads, Play Billing) мають власні consumer-правила в AAR; правила Capacitor дубльовані явно для надійності.
- `mapping.txt` потрапляє в підписаний `.aab` автоматично (`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`): Play Console сам розшифровує звіти про збої. Додатково можна зберегти `android/app/build/outputs/mapping/release/mapping.txt` для кожного релізу.

**Edge-to-edge (targetSdk 36, Android 15+)**
- `capacitor.config.ts`: `plugins.SystemBars` (Capacitor 8): `insetsHandling: 'css'` (типове значення, тепер явне) та `initialViewportFitValueHint: 'cover'`.
- `index.html` уже має `viewport-fit=cover`; CSS використовує `env(safe-area-inset-*)` через `--safe-t/b/l/r` (`src/styles/tokens.css`). Нова робота: модальні вікна (`.modal`, `.dialog`) і бічна панель на широких екранах (`.appbar`) тепер теж враховують ці відступи.
- Як це працює: WebView 140+ віддає справжні `env(safe-area-inset-*)`; старіші отримують нативний відступ від Capacitor, і `env()` = 0. В обох випадках верстка правильна. Android 14 і старіші: нічого не змінюється.

**Версія:** `versionCode 4`, `versionName 1.0.2`.

**Тести:** `tests/androidConfig.test.ts` (R8-патч ідемпотентний, keep-правила, конфіг SystemBars, safe-area у CSS).

## Як перевірити R8-збірку (Windows)
```powershell
npm run android:sync:closed
npm run check:closed
cd android
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
.\gradlew.bat :app:assembleRelease      # компіляція без підпису (перевірка R8)
.\gradlew.bat :app:bundleRelease        # .aab (підписуйте як у docs/closed-test-release.md)
```
Успіх: `BUILD SUCCESSFUL`, існує `app/build/outputs/mapping/release/mapping.txt`, у mapping `com.savoj13.freecv.SaveFilePlugin -> com.savoj13.freecv.SaveFilePlugin` (клас не перейменований). Обов'язково перевірте release-збірку на телефоні (чек-лист нижче): помилки R8 видно лише в роботі.

## Чек-лист на телефоні (release-збірка)
1. Застосунок відкривається, не закривається одразу; видно головний екран.
2. Створити CV, заповнити поля, змінити шаблон; перезапустити застосунок: дані на місці.
3. Експорт PDF з рекламою: показується реклама, PDF створюється.
4. Купівля «Pass na 30 dni» (тестова картка/ліцензійний тестер, збірка з Play).
5. Після купівлі: Pass активний, реклама не показується; перезапуск: Pass зберігся.
6. Збереження PDF у «Завантаження» (SaveFilePlugin) і «Поділитися».
7. Android 15+: рядок стану не перекриває верхню панель, нижня панель/кнопки не під навігаційною смугою, діалоги видно повністю; поворот екрана; темна тема; клавіатура в полях.
8. Android 14 або старіший (якщо є): вигляд без змін.

## Ризики R8
- Якщо щось працює в debug, але не в release (реклама, покупка, збереження) — спершу підозрюйте R8: у `adb logcat` шукайте `ClassNotFoundException`, `NoSuchMethodException`, `Plugin ... not found`; додайте `-keep` у `native/proguard-rules.pro.tpl` і виконайте `npm run android:native`.
- Оновлення залежностей (admob, native-purchases) може змінити імена класів: після оновлення знову перевіряйте release-збірку.
- Обфускація ускладнює читання логів: для розшифровки використовуйте `mapping.txt` (Play Console робить це сам, якщо mapping є в .aab).
- `shrinkResources` може вилучити ресурси, що викликаються за іменем рядком; наразі такого в застосунку немає.
- Знизу/зверху на старих WebView (< 140) фон під нативними відступами — колір вікна застосунку (світла/темна системна тема); якщо побачите контрастну смугу, скажіть: підберемо `windowBackground`.
