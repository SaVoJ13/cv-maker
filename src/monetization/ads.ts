import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { errorText } from '../export/errors';
import { MONETIZATION } from './config';
import { AdFailure, type AdsPort } from './adGateRunner';

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

/**
 * Zamek na eksporcie PDF działa tylko w aplikacji Android. W przeglądarce go nie ma;
 * wyjątek: tryb deweloperski (npm run dev) z parametrem ?gate w adresie, do testów okna.
 */
export function gateActive(): boolean {
  if (!MONETIZATION.gatingEnabled) return false;
  if (Capacitor.isNativePlatform()) return true;
  return import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('gate');
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
    if (!info.canRequestAds) throw new AdFailure('consent', 'ads not allowed (consent)');
    await AdMob.initialize();
  })().catch((e: unknown) => {
    sdkReady = null;
    throw e;
  });
  return sdkReady;
}

/** Reklama z nagrodą w AdMob (Capacitor). Wszystkie wywołania sieciowe reklam są tylko tutaj. */
export const admobPort: AdsPort = {
  async load() {
    try {
      await prepareSdk();
    } catch (e) {
      throw e instanceof AdFailure ? e : new AdFailure('load', errorText(e));
    }
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.prepareRewardVideoAd({ adId: MONETIZATION.rewardedAdUnitId, isTesting: MONETIZATION.testAds });
    } catch (e) {
      throw new AdFailure('load', errorText(e));
    }
  },
  async show() {
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
    return new Promise<'completed' | 'closed-early'>((resolve, reject) => {
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
              setTimeout(() => finish(() => resolve(rewarded ? 'completed' : 'closed-early')), 300);
            }),
            await AdMob.addListener(RewardAdPluginEvents.FailedToShow, (err) => {
              finish(() => reject(new AdFailure('show', err.message)));
            }),
          );
          await AdMob.showRewardVideoAd();
          rewarded = true; // obietnica kończy się dopiero po przyznaniu nagrody
        } catch (e) {
          finish(() => reject(new AdFailure('show', errorText(e))));
        }
      })();
    });
  },
};

/**
 * Port reklam dla bieżącej kompilacji: AdMob w aplikacji Android; w trybie deweloperskim (npm run dev)
 * symulator; w innych przypadkach reklamy są niedostępne (port odrzuca ładowanie).
 */
export function createAdsPort(): AdsPort {
  if (MONETIZATION.adsEnabled && Capacitor.isNativePlatform()) return admobPort;
  if (import.meta.env.DEV) {
    let inner: Promise<AdsPort> | null = null;
    const get = () => (inner ??= import('./adsStub').then((m) => m.stubAdsPortFromUrl()));
    return { load: async () => (await get()).load(), show: async () => (await get()).show() };
  }
  return {
    load: () => Promise.reject(new AdFailure('load', 'ads unavailable')),
    show: () => Promise.reject(new AdFailure('show', 'ads unavailable')),
  };
}

/** Formularz zgód reklamowych. Użytkownik w UE musi mieć możliwość zmiany decyzji. */
export async function openAdPrivacyOptions(): Promise<void> {
  try {
    await prepareSdk();
  } catch (e) {
    // brak zgody nie blokuje otwarcia formularza zmiany decyzji
    if (!(e instanceof AdFailure && e.reason === 'consent')) throw new AdError('consent', e);
  }
  const { AdMob } = await import('@capacitor-community/admob');
  try {
    await AdMob.showPrivacyOptionsForm();
  } catch (e) {
    throw new AdError('consent', e);
  }
}
