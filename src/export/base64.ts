/** Bajty → base64 (porcjami, żeby nie przepełnić stosu przy dużych plikach). Działa w przeglądarce i w Node. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
