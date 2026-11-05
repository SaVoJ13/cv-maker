// Перевірка виробничих збірок: у профілях closed і production не має бути інструментів розробника.
// Збирає кожен профіль у тимчасову папку, шукає знаки в усіх файлах і завершується з кодом 1 при збігу.
// Крок 5a.5 доповнить скрипт перевіркою config (testAds тощо).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Знаки, яких немає у closed і production (кнопка скидання, заглушки billing і реклам). */
export const FORBIDDEN = [
  ['CVMAKER_DEV_RESET_BUTTON_DEV_ONLY', 'кнопка розробника «Resetuj Pass i reklamy»'],
  ['Resetuj Pass i reklamy', 'підпис кнопки розробника'],
  ['CVMAKER_STUB_BILLING_DEV_ONLY', 'заглушка billing'],
  ['CVMAKER_STUB_ADS_DEV_ONLY', 'симулятор реклам'],
];

export function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export function findForbidden(files, read = (p) => readFileSync(p, 'utf8')) {
  const hits = [];
  for (const f of files) {
    const text = read(f);
    for (const [mark, what] of FORBIDDEN) if (text.includes(mark)) hits.push({ file: f, mark, what });
  }
  return hits;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const vite = join('node_modules', 'vite', 'bin', 'vite.js');
  let failed = false;
  for (const mode of ['closed', 'production']) {
    const out = mkdtempSync(join(tmpdir(), `cvmaker-${mode}-`));
    try {
      const r = spawnSync(process.execPath, [vite, 'build', '--mode', mode, '--outDir', out, '--emptyOutDir'], { stdio: 'pipe' });
      if (r.status !== 0) {
        console.error(`✗ збірка ${mode} не вдалась\n${r.stderr}${r.stdout}`);
        failed = true;
        continue;
      }
      const hits = findForbidden(walk(out));
      for (const h of hits) console.error(`✗ ${mode}: знайдено «${h.mark}» (${h.what}) у ${h.file}`);
      if (hits.length) failed = true;
      else console.log(`✓ ${mode}: інструментів розробника немає`);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }
  process.exit(failed ? 1 : 0);
}
