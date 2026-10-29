// Czyste funkcje bez zależności od przeglądarki ani Capacitora, dzięki temu da się je testować w Node.

/** Błąd z nazwą etapu (np. „share: …”), żeby w razie awarii było widać, który krok zawiódł. */
export class PdfStageError extends Error {
  constructor(
    readonly stage: 'engine' | 'photo' | 'build' | 'save' | 'share',
    cause: unknown,
  ) {
    super(`${stage}: ${errorText(cause)}`, { cause });
    this.name = 'PdfStageError';
  }
}

/** Wtyczki Capacitor rzucają zwykłe obiekty z polem `message`, nie instancje Error. */
export function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (e && typeof e === 'object') {
    const m = (e as { message?: unknown; errorMessage?: unknown }).message ?? (e as { errorMessage?: unknown }).errorMessage;
    if (typeof m === 'string' && m) return m;
  }
  return typeof e === 'string' && e ? e : 'unknown error';
}

/** Wtyczka natywna nie istnieje w tej kompilacji albo system jej nie obsługuje (np. Android starszy niż 10). */
export function isUnimplementedError(e: unknown): boolean {
  if (e instanceof PdfStageError) return isUnimplementedError(e.cause);
  if (e && typeof e === 'object' && (e as { code?: unknown }).code === 'UNIMPLEMENTED') return true;
  return /not implemented|unimplemented/i.test(errorText(e));
}
