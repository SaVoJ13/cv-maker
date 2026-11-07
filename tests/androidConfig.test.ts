import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enableR8 } from '../scripts/gradle-patch.mjs';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const GENERATED = `android {
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}`;

test('enableR8: вмикає minify і shrinkResources у згенерованому build.gradle', () => {
  const r = enableR8(GENERATED);
  assert.equal(r.changed, true);
  assert.match(r.text, /minifyEnabled true/);
  assert.match(r.text, /shrinkResources true/);
  assert.doesNotMatch(r.text, /minifyEnabled false/);
});

test('enableR8: ідемпотентний (повторний виклик нічого не змінює)', () => {
  const once = enableR8(GENERATED).text;
  const twice = enableR8(once);
  assert.equal(twice.changed, false);
  assert.equal(twice.text, once);
});

test('enableR8: без блоку release — зрозуміла помилка', () => {
  assert.throws(() => enableR8('android { }'), /release/);
});

test('поточний android/app/build.gradle має R8 увімкнений', () => {
  const g = read('android/app/build.gradle');
  assert.match(g, /minifyEnabled true/);
  assert.match(g, /shrinkResources true/);
});

test('шаблон proguard: keep для Capacitor, SaveFile, AdMob, native-purchases і рядків коду', () => {
  const t = read('native/proguard-rules.pro.tpl');
  for (const needle of [
    'extends com.getcapacitor.Plugin',
    '__APP_ID__.SaveFilePlugin',
    'com.getcapacitor.community.admob',
    'ee.forgr.nativepurchases',
    'JavascriptInterface',
    'LineNumberTable',
  ]) assert.ok(t.includes(needle), `немає: ${needle}`);
});

test('SaveFilePlugin і плагіни справді існують за іменами з keep-правил', () => {
  assert.ok(read('native/SaveFilePlugin.java.tpl').includes('class SaveFilePlugin extends Plugin'));
  assert.ok(read('node_modules/@capgo/native-purchases/android/src/main/java/ee/forgr/nativepurchases/NativePurchasesPlugin.java').length > 0);
  assert.ok(read('node_modules/@capacitor-community/admob/android/src/main/java/com/getcapacitor/community/admob/AdMob.java').length > 0);
});

test('edge-to-edge: viewport-fit=cover, SystemBars у capacitor.config, safe-area змінні в CSS', () => {
  assert.match(read('index.html'), /viewport-fit=cover/);
  const cfg = read('capacitor.config.ts');
  assert.match(cfg, /SystemBars/);
  assert.match(cfg, /insetsHandling:\s*'css'/);
  const tokens = read('src/styles/tokens.css');
  for (const side of ['top', 'bottom', 'left', 'right']) assert.ok(tokens.includes(`env(safe-area-inset-${side}`), side);
});

test('верхня панель і нижні елементи враховують safe-area', () => {
  const shell = read('src/styles/shell.css');
  assert.match(shell, /var\(--safe-t\)/);
  assert.match(shell, /var\(--safe-b\)/);
});
