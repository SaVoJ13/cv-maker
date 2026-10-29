import { registerPlugin } from '@capacitor/core';
import { bytesToBase64 } from './base64';
import { PdfStageError, isUnimplementedError } from './errors';
import { shareCacheFile, type FilePayload } from './nativeShare';

/** Własna wtyczka Androida (android/app/src/main/java/.../SaveFilePlugin.java): zapis do folderu „Pobrane” przez MediaStore. */
interface SaveFilePlugin {
  save(options: { fileName: string; mimeType: string; data: string }): Promise<{ fileName: string }>;
}
const SaveFile = registerPlugin<SaveFilePlugin>('SaveFile');

/** Plik zapisany na urządzeniu; zostaje w pamięci, żeby użytkownik mógł go jeszcze udostępnić. */
export interface SavedFile {
  fileName: string;
  payload: FilePayload;
}

function toBase64(payload: FilePayload): string {
  return bytesToBase64(payload.kind === 'bytes' ? payload.bytes : new TextEncoder().encode(payload.text));
}

/**
 * Zapisuje plik w folderze „Pobrane” telefonu. Gdy wtyczki nie ma (np. Android 9 i starszy),
 * wraca do okna „Udostępnij” i zwraca null: wtedy użytkownik dalej może zapisać plik z tego okna.
 */
export async function saveToDevice(fileName: string, mimeType: string, payload: FilePayload): Promise<SavedFile | null> {
  try {
    const saved = await SaveFile.save({ fileName, mimeType, data: toBase64(payload) });
    return { fileName: saved.fileName || fileName, payload };
  } catch (e) {
    if (isUnimplementedError(e)) {
      await shareCacheFile(fileName, payload);
      return null;
    }
    throw new PdfStageError('save', e);
  }
}
