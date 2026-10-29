import { PHOTO_MAX_SIDE, fitWithin, squareCrop, type PhotoCrop } from '../domain/photo';

/* Obsługa zdjęcia w przeglądarce (canvas). Logika geometrii leży w src/domain/photo.ts i jest testowana osobno. */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('read_failed'));
    r.readAsDataURL(file);
  });
}

/**
 * Wczytuje plik graficzny, zmniejsza go (dłuższy bok ≤ 640 px) i zwraca JPEG jako data URL.
 * Dzięki temu zdjęcie z telefonu (kilka MB) nie zapycha localStorage.
 * Rzuca błąd, gdy plik nie jest obrazem.
 */
export async function loadPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not_image');
  const img = await loadImage(await readAsDataUrl(file));
  const { w, h } = fitWithin(img.naturalWidth, img.naturalHeight, PHOTO_MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Przycina zdjęcie do koła (kadr jak w podglądzie) i zwraca PNG z przezroczystym tłem.
 * PDF dostaje gotowy kształt, bo pdfmake nie przycina obrazów do okręgu.
 */
export async function circlePng(dataUrl: string, crop: PhotoCrop, px = 480): Promise<string> {
  const img = await loadImage(dataUrl);
  const { sx, sy, size } = squareCrop(img.naturalWidth, img.naturalHeight, crop);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');
  ctx.beginPath();
  ctx.arc(px / 2, px / 2, px / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, size, size, 0, 0, px, px);
  return canvas.toDataURL('image/png');
}
