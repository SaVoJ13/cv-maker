import { useLayoutEffect, useState, type RefObject } from 'react';

/** Śledzi szerokość elementu (ResizeObserver, z awaryjnym nasłuchem okna). */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Śledzi wysokość (offsetHeight) elementu, np. arkusza, którego wysokość zależy od treści.
 * Przyjmuje sam element (ze stanu), żeby pomiar ruszył dopiero po jego zamontowaniu.
 */
export function useElementHeight(el: HTMLElement | null): number {
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return height;
}
