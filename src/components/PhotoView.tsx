import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Basics } from '../domain/types';
import { panBy, previewBox, shapeRadiusCss, zoomAt, type PhotoCrop } from '../domain/photo';

interface PhotoViewProps {
  b: Basics;
  className?: string;
  /** Stała średnica w px (zamiast skalowania rozmiarem zdjęcia w dokumencie) */
  fixed?: number;
  /** Gdy podane, zdjęcie można przeciągać i powiększać (mysz, rysik, palce) */
  onCrop?: (crop: PhotoCrop) => void;
  /** Powiększanie kółkiem myszy bez Ctrl (w podglądzie dokumentu kółko zostaje do przewijania strony) */
  wheelZoom?: boolean;
}

interface Pt {
  x: number;
  y: number;
}

const WHEEL_STEP = 0.0012;

/**
 * Okrągłe zdjęcie z kadrem z `squareCrop`: ramka ma overflow: hidden, a całe zdjęcie
 * jest w niej przesunięte i powiększone tak, żeby widać było dokładnie ten sam fragment,
 * który trafi do PDF. Proporcje zdjęcia odczytujemy po załadowaniu.
 *
 * Z `onCrop` zdjęcie reaguje na gesty: jeden palec lub mysz przesuwa, dwa palce (szczypanie)
 * powiększają wokół punktu między palcami, kółko myszy powiększa wokół kursora.
 * Rozmiary liczymy z `getBoundingClientRect`, więc gesty działają też wtedy, gdy arkusz
 * w podglądzie jest pomniejszony transformacją.
 */
export function PhotoView({ b, className = 'p-photo', fixed, onCrop, wheelZoom = false }: PhotoViewProps) {
  const [aspect, setAspect] = useState(1);
  const frameRef = useRef<HTMLSpanElement>(null);
  const pointers = useRef(new Map<number, Pt>());
  /** Najświeższy kadr, także między renderami (zdarzeń ruchu bywa więcej niż renderów) */
  const crop = useRef<PhotoCrop>({ x: b.photoX, y: b.photoY, zoom: b.photoZoom });
  const aspectRef = useRef(1);
  const onCropRef = useRef(onCrop);
  crop.current = { x: b.photoX, y: b.photoY, zoom: b.photoZoom };
  aspectRef.current = aspect;
  onCropRef.current = onCrop;
  const live = Boolean(onCrop);

  const box = previewBox(aspect, crop.current);
  const frame = {
    ...(fixed ? { width: fixed, height: fixed } : ({ '--ps': b.photoSize / 100 } as CSSProperties)),
    '--pr': shapeRadiusCss(b.photoShape),
    ...(live ? { touchAction: 'none' } : null),
  } as CSSProperties;

  const commit = (next: PhotoCrop) => {
    crop.current = next;
    onCropRef.current?.(next);
  };

  const onPointerDown = (e: { pointerId: number; clientX: number; clientY: number; currentTarget: HTMLElement }) => {
    if (!live) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* przeglądarka bez przechwytywania wskaźnika: ruch i tak działa w obrębie elementu */
    }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: { pointerId: number; clientX: number; clientY: number }) => {
    const prev = pointers.current.get(e.pointerId);
    const el = frameRef.current;
    if (!live || !prev || !el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const now: Pt = { x: e.clientX, y: e.clientY };
    let next = crop.current;

    if (pointers.current.size >= 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(now.x - other.x, now.y - other.y);
        const mid0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
        const mid1 = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
        if (d0 > 4) {
          next = zoomAt(
            aspectRef.current,
            next,
            next.zoom * (d1 / d0),
            (mid0.x - rect.left) / rect.width,
            (mid0.y - rect.top) / rect.height,
          );
        }
        next = panBy(aspectRef.current, next, (mid1.x - mid0.x) / rect.width, (mid1.y - mid0.y) / rect.height);
      }
    } else {
      next = panBy(aspectRef.current, next, (now.x - prev.x) / rect.width, (now.y - prev.y) / rect.height);
    }
    pointers.current.set(e.pointerId, now);
    commit(next);
  };

  const onPointerEnd = (e: { pointerId: number }) => {
    pointers.current.delete(e.pointerId);
  };

  /* Kółko myszy i szczypanie na gładziku (Ctrl + kółko): natywny nasłuch, bo React ma pasywne wheel. */
  useEffect(() => {
    const el = frameRef.current;
    if (!el || !live) return;
    const onWheel = (e: WheelEvent) => {
      if (!wheelZoom && !e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (rect.width < 1) return;
      const c = crop.current;
      commit(
        zoomAt(
          aspectRef.current,
          c,
          c.zoom * Math.exp(-e.deltaY * WHEEL_STEP * (e.ctrlKey ? 4 : 1)),
          (e.clientX - rect.left) / rect.width,
          (e.clientY - rect.top) / rect.height,
        ),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // commit korzysta tylko z refów
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, wheelZoom]);

  return (
    <span
      ref={frameRef}
      className={`${className}${live ? ' live' : ''}`}
      style={frame}
      aria-hidden="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
    >
      <img
        src={b.photo}
        alt=""
        draggable={false}
        onLoad={(e: { currentTarget: HTMLImageElement }) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          if (w > 0 && h > 0) setAspect(w / h);
        }}
        style={{ width: `${box.width}%`, height: `${box.height}%`, left: `${box.left}%`, top: `${box.top}%` }}
      />
    </span>
  );
}
