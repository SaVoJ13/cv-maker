import { bytesToBase64 } from './base64';
import { PdfStageError, errorText } from './errors';

export type FilePayload = { kind: 'bytes'; bytes: Uint8Array } | { kind: 'text'; text: string };

/**
 * Aplikacja Android (Capacitor): WebView nie obsługuje pobierania przez <a download>,
 * więc zapisujemy plik w pamięci podręcznej aplikacji i otwieramy systemowe okno „Udostępnij”
 * (Zapisz na dysku, Drive, e-mail, WhatsApp itd.). Błąd niesie nazwę etapu: save albo share.
 */
export async function shareCacheFile(fileName: string, payload: FilePayload): Promise<void> {
  let uri: string;
  try {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const written =
      payload.kind === 'bytes'
        ? await Filesystem.writeFile({ path: fileName, data: bytesToBase64(payload.bytes), directory: Directory.Cache })
        : await Filesystem.writeFile({ path: fileName, data: payload.text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    uri = written.uri;
  } catch (e) {
    throw new PdfStageError('save', e);
  }
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title: fileName, url: uri, dialogTitle: fileName });
  } catch (e) {
    // Zamknięcie okna „Udostępnij” bez wyboru to nie błąd
    if (/cancel/i.test(errorText(e))) return;
    throw new PdfStageError('share', e);
  }
}

/** Pobranie pliku w zwykłej przeglądarce. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
