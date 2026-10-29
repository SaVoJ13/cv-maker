import { useRef, useState } from 'react';
import { Dialog } from '../components/ui';
import { Icon, Spinner } from '../components/Icon';
import { errorText } from '../export/errors';
import { useStore } from '../store/StoreProvider';
import { showRewardedAd } from './ads';

/** Okno przed pobraniem PDF w aplikacji Android: obejrzyj reklamę albo anuluj. */
export function AdGateDialog({ onWatched, onClose }: { onWatched: () => void; onClose: () => void }) {
  const { t } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const watchRef = useRef<HTMLButtonElement>(null);

  const watch = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (await showRewardedAd()) {
        onWatched();
        return;
      }
      setError(t('gate_no_reward'));
    } catch (e) {
      console.error(e);
      setError(`${t('gate_fail')} (${errorText(e).slice(0, 140)})`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      title={t('gate_title')}
      titleId="gate-h"
      busy={busy}
      onClose={onClose}
      initialFocus={watchRef}
      actions={
        <>
          <button type="button" id="adCancel" className="btn" disabled={busy} onClick={onClose}>
            {t('gate_cancel')}
          </button>
          <button type="button" id="adWatch" ref={watchRef} className="btn primary" disabled={busy} onClick={() => void watch()}>
            {busy ? <Spinner /> : <Icon name="eye" size={16} />}
            {busy ? t('gate_loading') : t('gate_watch')}
          </button>
        </>
      }
    >
      <div className="dlg-body">
        <p>{t('gate_text')}</p>
        {error ? (
          <p className="dlg-err" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}
