/**
 * Ustawienia reklam. Zmieniasz tylko ten plik.
 *
 * Identyfikatory poniżej pochodzą z konta AdMob (aplikacja „CV Maker”, blok „Nagradzana”).
 * `admobAppId` trafia do AndroidManifest/strings.xml automatycznie przez `npm run android:sync`.
 *
 * PRZED PUBLIKACJĄ W GOOGLE PLAY (wersja produkcyjna): ustaw `testAds: false`.
 * W czasie testów zostaw `testAds: true`: wtyczka podstawia wtedy testowy blok Google, więc wyświetlają
 * się wyłącznie reklamy testowe i nie ma ryzyka zablokowania konta za własne kliknięcia.
 */
export const MONETIZATION = {
  /** Zamek na eksporcie PDF (Pass albo 2 reklamy). false = pobieranie zawsze wolne, bez okien. */
  gatingEnabled: true,
  /** Reklamy są dostępne (AdMob). true + gatingEnabled=false: reklam nie pokazujemy; false + gatingEnabled=true: tylko tryb deweloperski z reklamami symulowanymi. */
  adsEnabled: true,
  /** true = zawsze testowe reklamy Google. Nigdy nie klikaj prawdziwych reklam we własnej aplikacji. */
  testAds: true,
  /** Identyfikator aplikacji AdMob (z tyldą). Testowy Google: ca-app-pub-3940256099942544~3347511713 */
  admobAppId: 'ca-app-pub-2983570541795370~6308389405',
  /** Blok „Nagradzana” (ze ukośnikiem). Testowy Google: ca-app-pub-3940256099942544/5224354917 */
  rewardedAdUnitId: 'ca-app-pub-2983570541795370/4915204657',
} as const;
