/**
 * Посилання для QR-коду. Друкуємо лише те, що ввів користувач, і лише безпечні адреси:
 * https, без логіна й пароля в адресі, без пробілів і керівних символів, не IP-адреса.
 */

/** Максимальна довжина посилання (QR версії не вище 7 при рівні виправлення M). */
export const QR_URL_MAX = 120;
/** Максимальна довжина підпису під QR. */
export const QR_LABEL_MAX = 30;

export type QrUrlProblem = 'empty' | 'too_long' | 'spaces' | 'not_https' | 'non_ascii' | 'invalid' | 'credentials' | 'host';

export type QrUrlCheck = { ok: true; url: string; display: string } | { ok: false; reason: QrUrlProblem };

/** Хост «схожий на домен»: літери, цифри, дефіси, крапки; є крапка; верхній рівень з літер; не IPv4. */
function plausibleHost(host: string): boolean {
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(host)) return false;
  const tld = host.slice(host.lastIndexOf('.') + 1);
  return /^[a-z]{2,}$/i.test(tld) || /^xn--[a-z0-9-]+$/i.test(tld);
}

export function validateQrUrl(input: string): QrUrlCheck {
  const s = String(input ?? '').trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (s.length > QR_URL_MAX) return { ok: false, reason: 'too_long' };
  if (/[\s\u0000-\u001f\u007f]/.test(s)) return { ok: false, reason: 'spaces' };
  if (!/^https:\/\//i.test(s)) return { ok: false, reason: 'not_https' };
  if (/[^!-~]/.test(s)) return { ok: false, reason: 'non_ascii' };
  let parsed: URL;
  try {
    parsed = new URL(s);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'not_https' };
  if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' };
  if (!plausibleHost(parsed.hostname)) return { ok: false, reason: 'host' };
  // для друку текстом: без «https://» і без самотньої скісної риски в кінці
  const display = s.replace(/^https:\/\//i, '').replace(/\/$/, '');
  return { ok: true, url: s, display };
}
