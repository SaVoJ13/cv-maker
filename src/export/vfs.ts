/**
 * Czcionki pdfmake (Roboto) leżą w `pdfmake/build/vfs_fonts.js`. Plik zaczyna się od
 * `this.pdfMake = this.pdfMake || {}; this.pdfMake.vfs = {...}`, więc w zbudowanej aplikacji
 * (moduł ES, gdzie `this` jest `undefined`) zwykły `import` kończy się błędem
 * „Cannot read properties of undefined (reading 'pdfMake')”. W trybie `npm run dev` ten błąd
 * nie występuje, bo Vite opakowuje plik inaczej. Dlatego wczytujemy kod pliku jako tekst
 * i uruchamiamy go sami, z własnym obiektem jako `this`. Działa tak samo w dev, w buildzie
 * i w aplikacji Android, bez względu na to, jak bundler traktuje `this`.
 */
export type Vfs = Record<string, string>;

const FONT_KEY = 'Roboto-Regular.ttf';

function isVfs(v: unknown): v is Vfs {
  return typeof v === 'object' && v !== null && FONT_KEY in v;
}

export function vfsFromScript(source: string): Vfs {
  const ctx: { pdfMake?: { vfs?: unknown } } = {};
  const mod: { exports: unknown } = { exports: {} };
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('module', 'exports', source).call(ctx, mod, mod.exports);
  const fromExports = mod.exports as { pdfMake?: { vfs?: unknown } } | undefined;
  const found = [ctx.pdfMake?.vfs, mod.exports, fromExports?.pdfMake?.vfs].find(isVfs);
  if (!found) throw new Error('vfs_fonts: nieoczekiwany format pliku z czcionkami');
  return found;
}
