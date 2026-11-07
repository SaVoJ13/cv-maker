// Dodaje do projektu android/ własny kod natywny: zapis PDF w folderze „Pobrane” (SaveFilePlugin),
// reguły R8 (proguard-rules.pro + minifyEnabled/shrinkResources w build.gradle) oraz wpisy AdMob w AndroidManifest.xml i strings.xml (ID aplikacji z src/monetization/config.ts).
// Można uruchamiać wielokrotnie: niczego nie dubluje. Wywołuje się samo przez `npm run android:sync`.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { enableR8 } from './gradle-patch.mjs';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'android');
const TEST_ADMOB_APP_ID = 'ca-app-pub-3940256099942544~3347511713';

function fail(msg) {
  console.error(`\nBŁĄD: ${msg}\n`);
  process.exit(1);
}

if (!existsSync(androidDir)) {
  fail('Nie ma folderu android. Najpierw wykonaj: npx cap add android');
}

const config = readFileSync(join(root, 'capacitor.config.ts'), 'utf8');
const appId = /appId:\s*['"]([^'"]+)['"]/.exec(config)?.[1];
if (!appId || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(appId)) {
  fail(`Nie udało się odczytać poprawnego appId z capacitor.config.ts (znaleziono: ${appId ?? 'nic'}).`);
}

const monetization = readFileSync(join(root, 'src', 'monetization', 'config.ts'), 'utf8');
const admobAppId = /admobAppId:\s*['"](ca-app-pub-\d+~\d+)['"]/.exec(monetization)?.[1] ?? TEST_ADMOB_APP_ID;
const appName = /appName:\s*['"]([^'"]+)['"]/.exec(config)?.[1];
const main = join(androidDir, 'app', 'src', 'main');
const javaDir = join(main, 'java', ...appId.split('.'));
mkdirSync(javaDir, { recursive: true });

const template = (name) => readFileSync(join(root, 'native', name), 'utf8').replaceAll('__APP_ID__', appId);
const report = [];

// 1. Wtyczka zapisu pliku (zawsze aktualna wersja)
writeFileSync(join(javaDir, 'SaveFilePlugin.java'), template('SaveFilePlugin.java.tpl'));
report.push('SaveFilePlugin.java: zapisano');

// 2. MainActivity rejestruje wtyczkę
const activityPath = join(javaDir, 'MainActivity.java');
if (existsSync(join(javaDir, 'MainActivity.kt'))) {
  fail('MainActivity jest w Kotlinie (MainActivity.kt). Napisz do autora instrukcji, trzeba to zrobić ręcznie.');
}
const activity = existsSync(activityPath) ? readFileSync(activityPath, 'utf8') : '';
if (activity.includes('registerPlugin(SaveFilePlugin.class)')) {
  report.push('MainActivity.java: już zawiera rejestrację, bez zmian');
} else {
  writeFileSync(activityPath, template('MainActivity.java.tpl'));
  report.push('MainActivity.java: zaktualizowano');
}

// 3. AdMob w manifeście
const manifestPath = join(main, 'AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');
if (manifest.includes('com.google.android.gms.ads.APPLICATION_ID')) {
  report.push('AndroidManifest.xml: wpis AdMob już jest');
} else {
  if (!manifest.includes('</application>')) fail('W AndroidManifest.xml nie ma znacznika </application>.');
  manifest = manifest.replace(
    '</application>',
    '    <meta-data\n            android:name="com.google.android.gms.ads.APPLICATION_ID"\n            android:value="@string/admob_app_id"/>\n    </application>',
  );
  writeFileSync(manifestPath, manifest);
  report.push('AndroidManifest.xml: dodano wpis AdMob');
}

// 4. Nazwa pod ikoną (z appName) i identyfikator aplikacji AdMob w strings.xml
const stringsPath = join(main, 'res', 'values', 'strings.xml');
let strings = readFileSync(stringsPath, 'utf8');
if (appName) {
  const esc = appName.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'");
  const renamed = strings
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${esc}$2`)
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${esc}$2`);
  if (renamed !== strings) {
    strings = renamed;
    writeFileSync(stringsPath, strings);
    report.push(`strings.xml: nazwa aplikacji ustawiona na „${appName}”`);
  } else {
    report.push(`strings.xml: nazwa aplikacji już „${appName}”`);
  }
}
const admobTag = /<string name="admob_app_id">[^<]*<\/string>/;
const admobLine = `<string name="admob_app_id">${admobAppId}</string>`;
if (admobTag.test(strings)) {
  if (strings.includes(admobLine)) {
    report.push(`strings.xml: admob_app_id już ustawiony (${admobAppId})`);
  } else {
    strings = strings.replace(admobTag, admobLine);
    writeFileSync(stringsPath, strings);
    report.push(`strings.xml: admob_app_id zmieniony na ${admobAppId}`);
  }
} else {
  if (!strings.includes('</resources>')) fail('W strings.xml nie ma znacznika </resources>.');
  strings = strings.replace('</resources>', `    ${admobLine}\n</resources>`);
  writeFileSync(stringsPath, strings);
  report.push(`strings.xml: dodano admob_app_id (${admobAppId})`);
}

// 5. R8: reguły keep (z szablonu) i minifyEnabled/shrinkResources w build.gradle
writeFileSync(join(androidDir, 'app', 'proguard-rules.pro'), template('proguard-rules.pro.tpl'));
report.push('proguard-rules.pro: zapisano z szablonu native/proguard-rules.pro.tpl');
const gradlePath = join(androidDir, 'app', 'build.gradle');
const r8 = enableR8(readFileSync(gradlePath, 'utf8'));
if (r8.changed) writeFileSync(gradlePath, r8.text);
report.push(r8.changed ? 'build.gradle: włączono minifyEnabled i shrinkResources' : 'build.gradle: R8 już włączony');

console.log(`\nKod natywny dla ${appId}:\n - ${report.join('\n - ')}\n`);
