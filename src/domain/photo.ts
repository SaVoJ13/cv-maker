import type { PhotoShape } from './types';

/**
 * Kadrowanie zdjęcia do koła. Jedna geometria dla podglądu (CSS) i dla PDF (canvas),
 * żeby oba pokazywały ten sam kadr.
 *
 * Widoczny fragment to kwadrat o boku `min(w, h) / zoom`. Parametry `x` i `y` (0–100)
 * ustawiają jego położenie w obrazie (0 = lewa/górna krawędź, 100 = prawa/dolna).
 */
export interface PhotoCrop {
  /** 0–100 */
  x: number;
  /** 0–100 */
  y: number;
  /** 1 = cała krótsza strona zdjęcia, 3 = trzykrotne przybliżenie */
  zoom: number;
}

export interface PhotoView extends PhotoCrop {
  /** Rozmiar ramki w dokumencie, % domyślnej średnicy */
  size: number;
}

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;
export const SIZE_MIN = 70;
export const SIZE_MAX = 125;

export const PHOTO_DEFAULT: PhotoView = { x: 50, y: 30, zoom: 1, size: 100 };

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/** Naprawia dowolne wartości; obsługuje też starszy zapis z jednym polem `photoPos`. */
export function normalizePhotoView(raw: Record<string, unknown>): PhotoView {
  const legacy = typeof raw.photoPos === 'number' ? raw.photoPos : undefined;
  return {
    x: clamp(raw.photoX ?? legacy, 0, 100, PHOTO_DEFAULT.x),
    y: clamp(raw.photoY ?? legacy, 0, 100, PHOTO_DEFAULT.y),
    zoom: clamp(raw.photoZoom, ZOOM_MIN, ZOOM_MAX, PHOTO_DEFAULT.zoom),
    size: clamp(raw.photoSize, SIZE_MIN, SIZE_MAX, PHOTO_DEFAULT.size),
  };
}

export interface CropRect {
  sx: number;
  sy: number;
  size: number;
}

/** Fragment obrazu `w × h` w pikselach źródła (do `drawImage`). */
export function squareCrop(w: number, h: number, crop: PhotoCrop): CropRect {
  const zoom = clamp(crop.zoom, ZOOM_MIN, ZOOM_MAX, 1);
  const size = Math.min(w, h) / zoom;
  return {
    sx: (w - size) * (clamp(crop.x, 0, 100, 50) / 100),
    sy: (h - size) * (clamp(crop.y, 0, 100, 50) / 100),
    size,
  };
}

export interface PreviewBox {
  /** Wszystko w % boku kwadratowej ramki */
  width: number;
  height: number;
  left: number;
  top: number;
}

/**
 * Położenie całego zdjęcia (o proporcjach `aspect = w / h`) wewnątrz kwadratowej ramki,
 * tak aby w ramce był dokładnie ten sam kadr, co w `squareCrop`.
 */
export function previewBox(aspect: number, crop: PhotoCrop): PreviewBox {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const zoom = clamp(crop.zoom, ZOOM_MIN, ZOOM_MAX, 1);
  const width = (a >= 1 ? a : 1) * zoom * 100;
  const height = (a >= 1 ? 1 : 1 / a) * zoom * 100;
  return {
    width,
    height,
    left: -(width - 100) * (clamp(crop.x, 0, 100, 50) / 100),
    top: -(height - 100) * (clamp(crop.y, 0, 100, 50) / 100),
  };
}

/* ---------- gesty: przeciąganie i szczypanie bezpośrednio na zdjęciu ---------- */

interface Axis {
  /** Rozmiar zdjęcia w ramce (1 = bok ramki) */
  len: number;
  /** Przesunięcie lewej/górnej krawędzi zdjęcia względem ramki, w bokach ramki (≤ 0) */
  off: number;
}

function axes(aspect: number, crop: PhotoCrop): { w: Axis; h: Axis } {
  const b = previewBox(aspect, crop);
  return { w: { len: b.width / 100, off: b.left / 100 }, h: { len: b.height / 100, off: b.top / 100 } };
}

/** Zamienia przesunięcie zdjęcia w ramce z powrotem na pozycję 0–100; gdy nie ma luzu, zostawia starą. */
function toPos(off: number, len: number, old: number): number {
  const room = len - 1;
  if (room < 1e-9) return old;
  const clamped = Math.min(0, Math.max(-room, off));
  return (-clamped / room) * 100 + 0; // „+ 0” zamienia -0 na 0
}

/**
 * Przeciągnięcie zdjęcia o (dx, dy), liczone w bokach ramki (dx = 0.1 to 10 % szerokości ramki).
 * Zdjęcie jedzie za palcem, więc kadr (okno) przesuwa się w przeciwną stronę.
 */
export function panBy(aspect: number, crop: PhotoCrop, dx: number, dy: number): PhotoCrop {
  const { w, h } = axes(aspect, crop);
  return { ...crop, x: toPos(w.off + dx, w.len, crop.x), y: toPos(h.off + dy, h.len, crop.y) };
}

/**
 * Zmiana przybliżenia tak, żeby punkt zdjęcia pod (fx, fy) (ułamki boku ramki, 0.5 = środek)
 * został pod tym samym punktem. Przy szczypaniu (fx, fy) to środek między palcami.
 */
export function zoomAt(aspect: number, crop: PhotoCrop, zoom: number, fx = 0.5, fy = 0.5): PhotoCrop {
  const z = clamp(zoom, ZOOM_MIN, ZOOM_MAX, crop.zoom);
  const before = axes(aspect, crop);
  const after = axes(aspect, { ...crop, zoom: z });
  const solve = (a: Axis, b: Axis, f: number, old: number) => {
    const c = (f - a.off) / a.len; // który ułamek zdjęcia leży pod punktem f
    return toPos(f - c * b.len, b.len, old);
  };
  return {
    zoom: z,
    x: solve(before.w, after.w, fx, crop.x),
    y: solve(before.h, after.h, fy, crop.y),
  };
}

/** Maksymalny wymiar zapisywanego zdjęcia, żeby localStorage nie puchł. */
export const PHOTO_MAX_SIDE = 640;

/** Wymiary po zmniejszeniu tak, by dłuższy bok nie przekraczał `max`. Nie powiększa. */
export function fitWithin(w: number, h: number, max: number): { w: number; h: number } {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/* ---------- kształt zdjęcia ---------- */

/**
 * Promień zaokrąglenia jako ułamek boku kwadratu. Jedna tabela dla podglądu (CSS) i PDF (canvas),
 * żeby oba kształty wyglądały tak samo.
 */
export const PHOTO_SHAPE_RADIUS: Record<PhotoShape, number> = { circle: 0.5, rounded: 0.18, square: 0 };

/** Promień w pikselach dla kwadratu o boku `side`. */
export function shapeRadiusPx(shape: PhotoShape, side: number): number {
  return (PHOTO_SHAPE_RADIUS[shape] ?? PHOTO_SHAPE_RADIUS.circle) * side;
}

/** Wartość CSS `border-radius` dla podglądu (procent boku). */
export function shapeRadiusCss(shape: PhotoShape): string {
  return `${(PHOTO_SHAPE_RADIUS[shape] ?? PHOTO_SHAPE_RADIUS.circle) * 100}%`;
}

/** Największa średnica zdjęcia w PDF przy rozmiarze 100% (panel boczny), w punktach. */
export const PDF_PHOTO_MAX_PT = 108;
/** Zapas rozdzielczości: piksele PNG na punkt strony (wymagane ≥ 2). */
export const PDF_PHOTO_SCALE = 4;

/** Bok PNG dla PDF: co najmniej 2× największy rozmiar na stronie, w granicach 480–1024 px. */
export function pdfPhotoPx(photoSize: number): number {
  const pt = PDF_PHOTO_MAX_PT * (Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(photoSize) || 100)) / 100);
  return Math.min(1024, Math.max(480, Math.ceil(pt * PDF_PHOTO_SCALE)));
}
