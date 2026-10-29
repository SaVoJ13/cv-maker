import { parseBackup } from '../domain/backup';
import { pickBackupText, saveBackup } from '../export/backupFile';
import { errorText } from '../export/errors';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { useSavedFile } from './SavedFile';
import { useToast } from './Toast';

/** Zapis i wczytanie kopii zapasowej: ta sama logika co wcześniej na pulpicie, teraz do użycia w ustawieniach i w edytorze. */
export function useBackup() {
  const { t, cvs, importCvs } = useStore();
  const notify = useToast();
  const showSaved = useSavedFile();
  const own = cvs.filter((c) => !c.example);

  const save = async () => {
    if (!own.length) return notify(t('backup_none'));
    try {
      const saved = await saveBackup(cvs);
      if (saved) showSaved(saved);
      else notify(t('backup_saved'));
    } catch (e) {
      notify(`${t('backup_save_fail')} (${errorText(e).slice(0, 140)})`, 9000, 'error');
    }
  };

  const load = async () => {
    let text: string | null;
    try {
      text = await pickBackupText();
    } catch {
      return notify(t('backup_read_fail'), 3200, 'error');
    }
    if (text === null) return;
    const parsed = parseBackup(text);
    if (!parsed.ok) return notify(t(parsed.reason === 'empty' ? 'backup_empty' : 'backup_bad'), 5000, 'error');
    const { added, skipped } = importCvs(parsed.cvs);
    notify(`${t('backup_loaded')} ${added}${skipped ? `. ${t('backup_skipped')} ${skipped}` : ''}`, 5000);
  };

  return { save, load, hasOwn: own.length > 0 };
}

export function BackupBox() {
  const { t } = useStore();
  const { save, load } = useBackup();
  return (
    <div className="backup">
      <div className="row">
        <button type="button" className="btn" id="backupSave" onClick={() => void save()}>
          <Icon name="download" size={16} />
          {t('backup_save')}
        </button>
        <button type="button" className="btn" id="backupLoad" onClick={() => void load()}>
          <Icon name="upload" size={16} />
          {t('backup_load')}
        </button>
      </div>
    </div>
  );
}
