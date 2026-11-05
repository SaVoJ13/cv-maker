// Importy stylów (Vite) oraz pdfmake, które nie dostarcza własnych typów dla tych ścieżek.
declare module '*.css';
declare module 'pdfmake/build/pdfmake';
// Kod pliku z czcionkami wczytywany jako tekst (patrz src/export/vfs.ts)
declare module 'pdfmake/build/vfs_fonts.js?raw' {
  const source: string;
  export default source;
}

// Змінні Vite: DEV/PROD для режимів розробки й релізу (див. monetization/ads.ts)
interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean; readonly MODE: string };
}
