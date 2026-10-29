import { Capacitor } from '@capacitor/core';
import type { Cv } from '../domain/types';
import { backupFileName, serializeBackup } from '../domain/backup';
import { saveToDevice, type SavedFile } from './deviceFile';
import { downloadBlob } from './nativeShare';

/** Zapisuje kopię zapasową: pobranie w przeglądarce albo zapis w folderze „Pobrane” w aplikacji Android. */
export async function saveBackup(cvs: readonly Cv[]): Promise<SavedFile | null> {
  const json = serializeBackup(cvs);
  const name = backupFileName();
  if (Capacitor.isNativePlatform()) {
    return saveToDevice(name, 'application/json', { kind: 'text', text: json });
  }
  downloadBlob(new Blob([json], { type: 'application/json' }), name);
  return null;
}

/** Otwiera systemowy wybór pliku i zwraca jego tekst (albo null, gdy użytkownik nic nie wybrał). */
export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.style.display = 'none';
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      input.remove();
      fn();
    };
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return finish(() => resolve(null));
      file.text().then(
        (text) => finish(() => resolve(text)),
        (e: unknown) => finish(() => reject(e)),
      );
    });
    input.addEventListener('cancel', () => finish(() => resolve(null)));
    document.body.appendChild(input);
    input.click();
  });
}
