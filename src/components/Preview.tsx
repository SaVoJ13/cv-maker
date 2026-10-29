import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Cv } from '../domain/types';
import { A4_H, A4_W } from '../domain/constants';
import { pageCount } from '../domain/pages';
import { useElementHeight, useElementWidth } from '../hooks/useElementSize';
import { useStore } from '../store/StoreProvider';
import type { PhotoCrop } from '../domain/photo';
import { Icon } from './Icon';
import { Paper } from './Paper';

interface PreviewProps {
  cv: Cv;
  onPages: (pages: number) => void;
  onPhotoCrop?: (crop: PhotoCrop) => void;
  /** Przycisk obok skali (np. „Pobierz PDF"): widoczny tylko tam, gdzie widać podgląd */
  action?: ReactNode;
}

const STAGE_PAD = 16;
const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;

export function Preview({ cv, onPages, onPhotoCrop, action }: PreviewProps) {
  const { t } = useStore();
  const stageRef = useRef<HTMLDivElement>(null);
  const [paperEl, setPaperEl] = useState<HTMLDivElement | null>(null);
  /** null = „dopasuj do szerokości" (domyślnie); liczba = skala wybrana przyciskami */
  const [zoom, setZoom] = useState<number | null>(null);

  const stageW = useElementWidth(stageRef);
  const h = useElementHeight(paperEl);
  const fit = stageW > 0 ? Math.min(1, (stageW - STAGE_PAD * 2) / A4_W) : 1;
  const scale = zoom ?? fit;
  const pages = pageCount(h || A4_H);

  useEffect(() => onPages(pages), [pages, onPages]);

  const step = (dir: -1 | 1) => {
    const next = Math.round((scale + dir * ZOOM_STEP) * 100) / 100;
    setZoom(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next)));
  };

  const breaks = Array.from({ length: pages - 1 }, (_, i) => (
    <div key={i} className="pb" style={{ top: (i + 1) * A4_H }} data-l={`${t('page')} ${i + 2}`} />
  ));

  return (
    <div className="preview">
      <div className="prevbar">
        <span id="pgc" className="pgc">
          {t('pages')} {pages} · A4
        </span>
        <div className="zoomctl" role="group" aria-label={t('zoom_label')}>
          <button type="button" className="btn sm icon ghost" title={t('zoom_out')} aria-label={t('zoom_out')} disabled={scale <= ZOOM_MIN + 0.001} onClick={() => step(-1)}>
            <Icon name="zoom-out" size={16} />
          </button>
          <span className="zoomval" aria-live="polite">
            {Math.round(scale * 100)}%
          </span>
          <button type="button" className="btn sm icon ghost" title={t('zoom_in')} aria-label={t('zoom_in')} disabled={scale >= ZOOM_MAX - 0.001} onClick={() => step(1)}>
            <Icon name="zoom-in" size={16} />
          </button>
          <button type="button" className="btn sm ghost" disabled={zoom === null} onClick={() => setZoom(null)}>
            <Icon name="maximize" size={14} />
            {t('zoom_fit')}
          </button>
        </div>
        {action}
      </div>
      <div className="stage" ref={stageRef}>
        <div className="pw" style={{ width: A4_W * scale, height: (h || A4_H) * scale }}>
          <div className="scaler" style={{ transform: `scale(${scale})` }}>
            <Paper cv={cv} innerRef={setPaperEl} overlay={breaks} onPhotoCrop={onPhotoCrop} />
          </div>
        </div>
      </div>
    </div>
  );
}
