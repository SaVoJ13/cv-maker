// Перевірка виробничих збірок: у профілях closed і production не має бути інструментів розробника.
// Збирає кожен профіль у тимчасову папку, шукає знаки в усіх файлах і завершується з кодом 1 при збігу.
// Додатково перевіряє конфігурацію монетизації для профілю: production провалюється при testAds:true,
// closed дозволяє testAds:true. Код 1 = для публікації збірка НЕ готова.
// Запуск: `check-prod.mjs` (обидва профілі), `check-prod.mjs closed`, `check-prod.mjs production`;
// прапорець `--android` додатково перевіряє те, що справді піде в застосунок: android/app/src/main/assets/public
// (його створює `npm run android:sync:closed` / `android:sync`).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { MONETIZATION } from '../src/monetization/config.ts';
import { configProblems } from '../src/monetization/profile.ts';

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
  const args = process.argv.slice(2);
  const modes = args.filter((a) => a === 'closed' || a === 'production');
  const profiles = modes.length ? modes : ['closed', 'production'];
  let failed = false;
  console.log(`testAds зараз: ${MONETIZATION.testAds}`);
  for (const mode of profiles) {
    const out = mkdtempSync(join(tmpdir(), `cvmaker-${mode}-`));
    try {
      const r = spawnSync(process.execPath, [vite, 'build', '--mode', mode, '--outDir', out, '--emptyOutDir'], { stdio: 'pipe' });
      if (r.status !== 0) {
        console.error(`✗ збірка ${mode} не вдалась\n${r.stderr}${r.stdout}`);
        failed = true;
        continue;
      }
      const hits = findForbidden(walk(out));
      const cfg = configProblems(mode, MONETIZATION);
      for (const p of cfg) console.error(`✗ ${mode}: конфігурація: ${p}`);
      if (cfg.length) failed = true;
      for (const h of hits) console.error(`✗ ${mode}: знайдено «${h.mark}» (${h.what}) у ${h.file}`);
      if (hits.length) failed = true;
      else console.log(`✓ ${mode}: інструментів розробника і заглушок у збірці немає`);
      if (!cfg.length) console.log(`✓ ${mode}: конфігурація монетизації відповідає профілю`);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }
  if (args.includes('--android')) {
    const dir = join('android', 'app', 'src', 'main', 'assets', 'public');
    if (!existsSync(dir)) {
      console.error('✗ android: немає ' + dir + ' — спершу виконайте npm run android:sync:closed');
      failed = true;
    } else {
      const hits = findForbidden(walk(dir));
      for (const h of hits) console.error('✗ android: знайдено «' + h.mark + '» (' + h.what + ') у ' + h.file);
      if (hits.length) failed = true;
      else console.log('✓ android: у файлах застосунку (assets/public) заглушок і кнопки розробника немає');
    }
  }
  process.exit(failed ? 1 : 0);
}
