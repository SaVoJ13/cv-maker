/** Mieszanie kolorów #RRGGBB: `t` = 0 zwraca `a`, `t` = 1 zwraca `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const m = (x: number, y: number) =>
    Math.round(x + (y - x) * Math.min(1, Math.max(0, t)))
      .toString(16)
      .padStart(2, '0');
  return `#${m(r1 ?? 0, r2 ?? 0)}${m(g1 ?? 0, g2 ?? 0)}${m(b1 ?? 0, b2 ?? 0)}`.toUpperCase();
}

/** Jasne tło paska bocznego: kolor akcentu rozjaśniony do ~9%. */
export const tint = (accent: string): string => mixHex(accent, '#FFFFFF', 0.91);

/* ---------- контраст і відстань між кольорами ---------- */

const channel = (v: number): number => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const linear = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return [r ?? 0, g ?? 0, b ?? 0];
};

/** Відносна яскравість за WCAG 2.x (0–1). */
export function luminance(hex: string): number {
  const [r, g, b] = linear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Коефіцієнт контрасту WCAG двох кольорів #RRGGBB (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Колір #RRGGBB у просторі CIELAB (джерело світла D65). */
export function toLab(hex: string): [number, number, number] {
  const [r, g, b] = linear(hex);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** Різниця кольорів ΔE (CIE76) у просторі CIELAB: чим більше, тим помітніше відрізняються. */
export function deltaE(a: string, b: string): number {
  const p = toLab(a);
  const q = toLab(b);
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
