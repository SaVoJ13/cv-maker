import { PHOTO_MAX_SIDE, fitWithin, shapeRadiusPx, squareCrop, type PhotoCrop } from '../domain/photo';
import type { PhotoShape } from '../domain/types';

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

/** Ścieżka kształtu zdjęcia (koło, zaokrąglony kwadrat albo kwadrat) o boku `side` w punkcie (0, 0). */
function traceShape(ctx: CanvasRenderingContext2D, shape: PhotoShape, side: number): void {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(side / 2, side / 2, side / 2, 0, Math.PI * 2);
  } else {
    const r = shapeRadiusPx(shape, side);
    ctx.moveTo(r, 0);
    ctx.arcTo(side, 0, side, side, r);
    ctx.arcTo(side, side, 0, side, r);
    ctx.arcTo(0, side, 0, 0, r);
    ctx.arcTo(0, 0, side, 0, r);
  }
  ctx.closePath();
}

/**
 * Przycina zdjęcie do wybranego kształtu (kadr jak w podglądzie) i zwraca PNG z przezroczystym tłem.
 * PDF dostaje gotowy kształt, bo pdfmake nie przycina obrazów. Krawędź jest gładka: zdjęcie rysujemy
 * w pełnym kwadracie, a kształt nakładamy maską (`destination-in`, wypełnienie z antyaliasingiem),
 * zamiast ostrego `clip()`. Rozmiar `px` dobiera `pdfPhotoPx` (≥ 2× rozmiar na stronie).
 */
export async function shapedPng(dataUrl: string, crop: PhotoCrop, shape: PhotoShape, px = 480): Promise<string> {
  const img = await loadImage(dataUrl);
  const { sx, sy, size } = squareCrop(img.naturalWidth, img.naturalHeight, crop);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no_canvas');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, size, size, 0, 0, px, px);
  if (shape !== 'square') {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    traceShape(ctx, shape, px);
    ctx.fill();
  }
  return canvas.toDataURL('image/png');
}
