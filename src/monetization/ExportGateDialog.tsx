import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog } from '../components/ui';
import { Icon, Spinner } from '../components/Icon';
import { fmt } from '../domain/i18n/fmt';
import { useStore } from '../store/StoreProvider';
import { errorText } from '../export/errors';
import { openAdPrivacyOptions } from './ads';
import { billingAvailable, getBilling, isStubBilling, type PassProduct, type Redeem } from './billing';
import { gateView } from './gateView';
import { useAdGate } from './useAdGate';

interface Props {
  /** Перша реклама вже переглянута (прогрес живий до 10 хв) */
  ad1Done: boolean;
  /** Перша реклама з пари переглянута до кінця */
  onAd1: () => void;
  /** Нагорода видана (дві реклами або запасний відлік); далі вікно закривається й починається експорт */
  onGranted: () => void;
  /** Видати Pass за покупку (синхронно зберігає стан). Викликається ДО споживання токена в Google Play. */
  onRedeem: Redeem;
  /** Pass куплено й записано; далі вікно закривається й починається експорт */
  onPass: () => void;
  onClose: () => void;
}

/**
 * Вікно перед експортом PDF: умова показується заздалегідь, потім дві rewarded-реклами підряд
 * (запасний відлік 20 с лише для другої) або покупка Pass 30 днів.
 */
export function ExportGateDialog({ ad1Done, onAd1, onGranted, onRedeem, onPass, onClose }: Props) {
  const { t } = useStore();
  const gate = useAdGate({ ad1Done, onAd1Rewarded: onAd1, onGranted });
  const billing = useMemo(() => getBilling(), []);
  const canBill = useMemo(() => billingAvailable(), []);
  const [view, setView] = useState<'ads' | 'pass'>('ads');
  const [product, setProduct] = useState<PassProduct | null>(null);
  // Pass пропонуємо лише коли платформа дозволяє І продукт справді завантажено з Google Play
  const withPass = canBill && product !== null;
  const [buying, setBuying] = useState(false);
  const [passError, setPassError] = useState('');
  const [passInfo, setPassInfo] = useState('');
  const [consentError, setConsentError] = useState('');
  const primaryRef = useRef<HTMLButtonElement>(null);
  const v = gateView(gate.state, ad1Done);

  useEffect(() => {
    let alive = true;
    if (!canBill) return;
    billing.product().then(
      (p) => alive && setProduct(p),
      (e: unknown) => {
        console.warn(e); // Pass не пропонуємо, лишаються реклами
        if (alive) setProduct(null);
      },
    );
    return () => {
      alive = false;
    };
  }, [billing, canBill]);

  const priceText = product?.price ?? t('gate_price_unknown');
  const close = () => {
    gate.cancel();
    onClose();
  };

  const buy = async () => {
    if (buying) return;
    setBuying(true);
    setPassError('');
    setPassInfo('');
    try {
      const r = await billing.buy(onRedeem);
      if (r === 'granted') onPass();
      else if (r === 'pending') setPassInfo(t('pass_pending'));
      else if (r === 'error') setPassError(t('pass_fail'));
      // 'cancelled': користувач сам передумав, це не помилка
    } catch (e) {
      console.error(e);
      setPassError(t('pass_fail'));
    } finally {
      setBuying(false);
    }
  };

  const changeConsent = () => {
    setConsentError('');
    openAdPrivacyOptions().catch((e: unknown) => setConsentError(`${t('gate_fail')} (${errorText(e).slice(0, 120)})`));
  };

  /* ---------- Pass ---------- */
  if (view === 'pass' && withPass) {
    return (
      <Dialog
        title={t('pass_title')}
        titleId="gate-h"
        busy={buying}
        onClose={close}
        initialFocus={primaryRef}
        badge={
          <span className="dlg-badge warm">
            <Icon name="shield" size={26} />
          </span>
        }
        actions={
          <>
            <button type="button" className="btn" disabled={buying} onClick={() => setView('ads')}>
              {t('pass_back')}
            </button>
            <button type="button" id="passBuy" ref={primaryRef} className="btn primary" disabled={buying} onClick={() => void buy()}>
              {buying ? <Spinner /> : <Icon name="check" size={16} />}
              {buying ? t('pass_buying') : t('pass_buy')}
            </button>
          </>
        }
      >
        <div className="dlg-body">
          <p>{fmt(t('pass_text'), { price: priceText })}</p>
          {isStubBilling() ? <p className="hint">{t('pass_stub_note')}</p> : null}
          {passInfo ? (
            <p className="hint" role="status">
              {passInfo}
            </p>
          ) : null}
          {passError ? (
            <p className="dlg-err" role="alert">
              {passError}
            </p>
          ) : null}
        </div>
      </Dialog>
    );
  }

  /* ---------- reklamy ---------- */
  const working = v.phase === 'loading' || v.phase === 'showing' || v.phase === 'countdown';
  let status: string | null = null;
  let error: string | null = null;
  if (v.phase === 'loading') status = fmt(t('gate_loading_n'), { n: v.adIndex });
  else if (v.phase === 'showing') status = fmt(t('gate_showing_n'), { n: v.adIndex });
  else if (v.phase === 'countdown') status = v.paused ? t('gate_countdown_paused') : fmt(t('gate_countdown'), { s: v.seconds ?? 0 });
  else if (v.phase === 'failed') error = v.reason === 'consent' ? t(withPass ? 'gate_consent' : 'gate_consent_ads') : t('gate_fail');
  else if (v.phase === 'early') error = t('gate_no_reward');

  return (
    <Dialog
      title={t('gate_title')}
      titleId="gate-h"
      busy={v.phase === 'showing'}
      onClose={close}
      initialFocus={primaryRef}
      badge={
        <span className="dlg-badge warm">
          <Icon name="download" size={26} />
        </span>
      }
      actions={
        <>
          <button type="button" id="adCancel" className="btn" disabled={v.phase === 'showing'} onClick={close}>
            {t('gate_cancel')}
          </button>
          {withPass && !working && v.phase !== 'granted' ? (
            <button type="button" id="adBuy" className="btn" onClick={() => setView('pass')}>
              <Icon name="shield" size={16} />
              {t('gate_buy')}
            </button>
          ) : null}
          {v.phase === 'failed' && v.reason === 'consent' ? (
            <button type="button" id="adConsent" className="btn" onClick={changeConsent}>
              {t('gate_consent_btn')}
            </button>
          ) : null}
          {!working && v.phase !== 'granted' ? (
            <button
              type="button"
              id="adWatch"
              ref={primaryRef}
              className="btn primary"
              onClick={() => (v.canRetry ? gate.retry() : gate.start())}
            >
              {v.canRetry ? <Icon name="rotate" size={16} /> : <Icon name="eye" size={16} />}
              {v.canRetry ? t('gate_retry') : ad1Done ? t('gate_watch2') : t('gate_watch')}
            </button>
          ) : null}
        </>
      }
    >
      <div className="dlg-body">
        <p id="gate-req">{withPass ? fmt(t('gate_req'), { price: priceText }) : t('gate_req_ads')}</p>
        {ad1Done && v.phase === 'intro' ? <p className="hint">{t('gate_req1')}</p> : null}
        {status ? (
          <p className="gate-status" role="status" aria-live="polite">
            {v.phase === 'loading' ? <Spinner /> : null} {status}
          </p>
        ) : null}
        {v.phase === 'countdown' ? (
          <div className="gate-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.progress * 100)}>
            <span style={{ width: `${Math.round(v.progress * 100)}%` }} />
          </div>
        ) : null}
        {error ? (
          <p className="dlg-err" role="alert">
            {error}
          </p>
        ) : null}
        {consentError ? (
          <p className="dlg-err" role="alert">
            {consentError}
          </p>
        ) : null}
        {withPass ? <p className="hint">{t('gate_pass_note')}</p> : null}
        <p className="hint">{t(withPass ? 'gate_offline_note' : 'gate_offline_ads')}</p>
      </div>
    </Dialog>
  );
}
