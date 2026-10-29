import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { errorText } from '../export/errors';
import type { SavedFile } from '../export/deviceFile';
import { shareCacheFile } from '../export/nativeShare';
import { useStore } from '../store/StoreProvider';
import { Icon, Spinner } from './Icon';
import { useToast } from './Toast';
import { Dialog } from './ui';

type Show = (file: SavedFile) => void;

const Ctx = createContext<Show>(() => undefined);

/**
 * Okno po zapisie pliku w folderze „Pobrane” (aplikacja Android): potwierdza, gdzie jest plik,
 * i pozwala od razu go udostępnić (e-mail, komunikator, Dysk).
 */
export function SavedFileProvider({ children }: { children: ReactNode }) {
  const { t } = useStore();
  const notify = useToast();
  const [file, setFile] = useState<SavedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);
  const show = useCallback<Show>((f) => setFile(f), []);

  const share = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      await shareCacheFile(file.fileName, file.payload);
    } catch (e) {
      console.error(e);
      notify(`${t('pdf_fail')} (${errorText(e).slice(0, 140)})`, 9000, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Ctx.Provider value={show}>
      {children}
      {file ? (
        <Dialog
          title={t('saved_title')}
          titleId="saved-h"
          busy={busy}
          onClose={() => setFile(null)}
          initialFocus={doneRef}
          badge={
            <span className="dlg-badge pop">
              <Icon name="check" size={28} />
            </span>
          }
          actions={
            <>
              <button type="button" id="savedShare" className="btn" disabled={busy} onClick={() => void share()}>
                {busy ? <Spinner /> : <Icon name="upload" size={16} />}
                {t('saved_share')}
              </button>
              <button type="button" id="savedDone" ref={doneRef} className="btn primary" disabled={busy} onClick={() => setFile(null)}>
                {t('saved_done')}
              </button>
            </>
          }
        >
          <div className="dlg-body">
            <p className="dlg-name">{file.fileName}</p>
            <p>{t('saved_text')}</p>
          </div>
        </Dialog>
      ) : null}
    </Ctx.Provider>
  );
}

export function useSavedFile(): Show {
  return useContext(Ctx);
}
