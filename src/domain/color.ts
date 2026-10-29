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
