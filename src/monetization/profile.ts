/**
 * Профілі збірки (Vite --mode): dev, closed, production.
 *  - dev: розробка й перевірка на телефоні; заглушка billing, симульовані реклами в `npm run dev`, кнопка скидання.
 *  - closed: закритий тест у Google Play; справжній Billing (з кроку 5b), testAds може бути true; заглушок немає.
 *  - production: випуск; testAds: false, жодних заглушок.
 * Модуль чистий (без import.meta.env), щоб його перевіряли тести й scripts/check-prod.mjs.
 */
export type BuildProfile = 'dev' | 'closed' | 'production';

export interface MonetizationConfig {
  readonly gatingEnabled: boolean;
  readonly adsEnabled: boolean;
  readonly testAds: boolean;
  readonly admobAppId: string;
  readonly rewardedAdUnitId: string;
}

/** Режим Vite → профіль; будь-що невідоме вважається production (найсуворіше). */
export function profileFromMode(mode: string): BuildProfile {
  return mode === 'dev' || mode === 'closed' ? mode : 'production';
}

/** Ідентифікатори тестових блоків Google: у виробничій збірці їх бути не може. */
const GOOGLE_SAMPLE_PUBLISHER = 'ca-app-pub-3940256099942544';

/**
 * Проблеми конфігурації для профілю (порожній масив = усе гаразд).
 * dev: без вимог. closed: замок і реклами ввімкнені, testAds може бути true. production: ще й testAds: false.
 */
export function configProblems(profile: BuildProfile, cfg: MonetizationConfig): string[] {
  if (profile === 'dev') return [];
  const out: string[] = [];
  if (!cfg.gatingEnabled) out.push('gatingEnabled має бути true (замок експорту)');
  if (!cfg.adsEnabled) out.push('adsEnabled має бути true (реклами)');
  if (profile === 'production') {
    if (cfg.testAds) out.push('testAds має бути false у виробничій збірці');
    for (const id of [cfg.admobAppId, cfg.rewardedAdUnitId]) {
      if (id.startsWith(GOOGLE_SAMPLE_PUBLISHER)) out.push('у конфігурації тестовий ідентифікатор Google замість свого блоку AdMob');
    }
  }
  return out;
}

/** Кидає помилку з переліком проблем; для виробничої збірки перед публікацією. */
export function assertProductionConfig(cfg: MonetizationConfig, profile: BuildProfile = 'production'): void {
  const p = configProblems(profile, cfg);
  if (p.length) throw new Error(`Конфігурація профілю «${profile}» недійсна:\n - ${p.join('\n - ')}`);
}
