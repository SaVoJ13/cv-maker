import type { Cv } from '../domain/types';
import { buildPdfDocument, pdfFileName } from '../domain/pdf';
import { showsPhoto } from '../domain/cvOps';
import { pdfPhotoPx } from '../domain/photo';
import { Capacitor } from '@capacitor/core';
import { PdfStageError } from './errors';
import { saveToDevice, type SavedFile } from './deviceFile';
import { downloadBlob } from './nativeShare';
import { shapedPng } from './photo';
import { vfsFromScript } from './vfs';

interface PdfMakeLike {
  vfs?: unknown;
  createPdf: (doc: unknown) => { getBlob: (cb: (blob: Blob) => void) => void };
}

type Loose = Record<string, unknown> & { default?: unknown };

let enginePromise: Promise<PdfMakeLike> | null = null;

/** Biblioteka jest duża, więc ładujemy ją dopiero przy pierwszym eksporcie. */
function loadEngine(): Promise<PdfMakeLike> {
  enginePromise ??= (async () => {
    const [core, fonts] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts.js?raw'),
    ]);
    const coreMod = core as unknown as Loose;
    const engine = (coreMod.default ?? coreMod) as PdfMakeLike;
    engine.vfs = vfsFromScript(fonts.default);
    return engine;
  })().catch((e: unknown) => {
    enginePromise = null;
    throw e;
  });
  return enginePromise;
}

async function stage<T>(name: PdfStageError['stage'], run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    throw new PdfStageError(name, e);
  }
}

export async function createPdfBlob(cv: Cv): Promise<Blob> {
  const engine = await stage('engine', loadEngine);
  const b = cv.data.basics;
  const photoPng = showsPhoto(cv)
    ? await stage('photo', () => shapedPng(b.photo, { x: b.photoX, y: b.photoY, zoom: b.photoZoom }, b.photoShape, pdfPhotoPx(b.photoSize)))
    : undefined;
  return stage(
    'build',
    () =>
      new Promise<Blob>((resolve, reject) => {
        // pdfmake raportuje błędy renderowania asynchronicznie, więc dodajemy też limit czasu
        const timer = setTimeout(() => reject(new Error('timeout')), 30_000);
        try {
          engine.createPdf(buildPdfDocument(cv, photoPng)).getBlob((blob) => {
            clearTimeout(timer);
            resolve(blob);
          });
        } catch (e) {
          clearTimeout(timer);
          reject(e);
        }
      }),
  );
}

/**
 * Tworzy PDF i zapisuje go: pobranie w przeglądarce albo zapis w folderze „Pobrane” w aplikacji Android.
 * Zwraca zapisany plik (do wyświetlenia okna z opcją „Udostępnij”) albo null, gdy nie ma czego pokazać.
 */
export async function downloadPdf(cv: Cv): Promise<SavedFile | null> {
  const blob = await createPdfBlob(cv);
  const name = pdfFileName(cv);
  if (Capacitor.isNativePlatform()) {
    return saveToDevice(name, 'application/pdf', { kind: 'bytes', bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  downloadBlob(blob, name);
  return null;
}
