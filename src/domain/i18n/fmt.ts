/** Підставляє значення в `{name}` усередині тексту інтерфейсу; невідомі плейсхолдери лишає як є. */
export function fmt(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
