// Чисті функції для правки згенерованих Android-файлів (щоб тестувати без Android).
// Використовує scripts/install-native.mjs: налаштування R8 не губляться після `npx cap add android`.

/** Вмикає minifyEnabled і shrinkResources у блоці release. Повертає { text, changed }. Можна викликати повторно. */
export function enableR8(gradle) {
  const m = /(buildTypes\s*\{[\s\S]*?release\s*\{)([\s\S]*?)(\n\s*\}\s*\n\s*\})/.exec(gradle);
  if (!m) throw new Error('У build.gradle не знайдено блок buildTypes { release { ... } }.');
  let body = m[2];
  const indent = /\n(\s+)\S/.exec(body)?.[1] ?? '            ';
  const before = body;
  if (/minifyEnabled\s+\S+/.test(body)) body = body.replace(/minifyEnabled\s+\S+/, 'minifyEnabled true');
  else body = `\n${indent}minifyEnabled true${body}`;
  if (/shrinkResources\s+\S+/.test(body)) body = body.replace(/shrinkResources\s+\S+/, 'shrinkResources true');
  else body = body.replace(/(minifyEnabled true)/, `$1\n${indent}shrinkResources true`);
  if (!/proguardFiles[^\n]*proguard-rules\.pro/.test(body)) {
    body += `\n${indent}proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`;
  }
  if (body === before) return { text: gradle, changed: false };
  return { text: gradle.slice(0, m.index) + m[1] + body + m[3] + gradle.slice(m.index + m[0].length), changed: true };
}
