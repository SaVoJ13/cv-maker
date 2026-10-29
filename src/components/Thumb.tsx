import { useRef } from 'react';
import type { Cv } from '../domain/types';
import { A4_H, A4_W } from '../domain/constants';
import { useElementWidth } from '../hooks/useElementSize';
import { Paper } from './Paper';

/** Miniatura CV na pulpicie: pierwszy arkusz skalowany do szerokości karty. */
export function Thumb({ cv }: { cv: Cv }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useElementWidth(ref);
  const s = w > 0 ? w / A4_W : 0.3;
  return (
    <div className="thumb" ref={ref} aria-hidden="true" style={{ height: A4_H * s }}>
      <div className="scaler" style={{ transform: `scale(${s})` }}>
        <Paper cv={cv} />
      </div>
    </div>
  );
}
