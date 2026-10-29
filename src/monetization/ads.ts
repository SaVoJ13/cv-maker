import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { errorText } from '../export/errors';
import { MONETIZATION } from './config';

/** Błąd z nazwą etapu (consent, load, show), żeby w razie awarii było widać, który krok zawiódł. */
export class AdError extends Error {
  constructor(
    readonly stage: 'consent' | 'load' | 'show',
    cause: unknown,
  ) {
    super(`${stage}: ${errorText(cause)}`);
    this.name = 'AdError';
  }
}

/** Reklamy działają tylko w aplikacji Android. Wersja w przeglądarce nie ma ani reklam, ani blokady. */
export function adsActive(): boolean {
  return MONETIZATION.adsEnabled && Capacitor.isNativePlatform();
}

let sdkReady: Promise<void> | null = null;

/** Zgoda (Google UMP, wymagana w UE) i uruchomienie SDK. Wykonuje się raz, przed pierwszą reklamą. */
function prepareSdk(): Promise<void> {
  sdkReady ??= (async () => {
    const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
    let info = await AdMob.requestConsentInfo();
    if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) {
      info = await AdMob.showConsentForm();
    }
    if (!info.canRequestAds) throw new Error('ads not allowed (consent)');
    await AdMob.initialize();
  })().catch((e: unknown) => {
    sdkReady = null;
    throw e;
  });
  return sdkReady;
}

async function stage<T>(name: AdError['stage'], run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw new AdError(name, e);
  }
}

/**
 * Pokazuje reklamę z nagrodą. Zwraca true tylko wtedy, gdy użytkownik obejrzał ją do końca.
 * Błąd (brak internetu, brak reklamy do wyświetlenia, brak zgody) kończy się wyjątkiem AdError.
 */
export async function showRewardedAd(): Promise<boolean> {
  await stage('consent', prepareSdk);
  const { AdMob, RewardAdPluginEvents } = await stage('load', () => import('@capacitor-community/admob'));
  await stage('load', () =>
    AdMob.prepareRewardVideoAd({ adId: MONETIZATION.rewardedAdUnitId, isTesting: MONETIZATION.testAds }),
  );
  return stage(
    'show',
    () =>
      new Promise<boolean>((resolve, reject) => {
        const handles: PluginListenerHandle[] = [];
        let rewarded = false;
        let closed = false;
        const finish = (done: () => void) => {
          if (closed) return;
          closed = true;
          handles.forEach((h) => void h.remove());
          done();
        };
        void (async () => {
          try {
            handles.push(
              await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
                rewarded = true;
              }),
              // Nagroda przychodzi tuż przed zamknięciem reklamy, więc dajemy jej chwilę na dotarcie
              await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                setTimeout(() => finish(() => resolve(rewarded)), 300);
              }),
              await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
                finish(() => reject(new Error(err.message)));
              }),
            );
            await AdMob.showRewardVideoAd();
            rewarded = true; // obietnica kończy się dopiero po przyznaniu nagrody
          } catch (e) {
            finish(() => reject(e));
          }
        })();
      }),
  );
}

/** Formularz zgód reklamowych. Użytkownik w UE musi mieć możliwość zmiany decyzji. */
export async function openAdPrivacyOptions(): Promise<void> {
  await stage('consent', prepareSdk);
  const { AdMob } = await import('@capacitor-community/admob');
  await stage('consent', () => AdMob.showPrivacyOptionsForm());
}
