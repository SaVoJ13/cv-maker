import test from 'node:test';
import assert from 'node:assert/strict';
import jsQR from 'jsqr';
import { QR_MAX_VERSION, QR_QUIET, qrMatrix, type QrMatrix } from '../src/domain/qr.ts';
import { QR_LABEL_MAX, QR_URL_MAX, validateQrUrl } from '../src/domain/qrUrl.ts';
import { normalizeExtras } from '../src/domain/extras.ts';

/** Малює матрицю в RGBA (чорне на білому, з тихою зоною) і розкодовує справжнім декодером. */
export function decodeMatrix(m: QrMatrix, scale = 6): string | null {
  const side = (m.size + 2 * QR_QUIET) * scale;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) {
      if (!m.modules[r][c]) continue;
      for (let y = 0; y < scale; y++) {
        for (let x = 0; x < scale; x++) {
          const i = (((r + QR_QUIET) * scale + y) * side + (c + QR_QUIET) * scale + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

const URLS = [
  'https://www.linkedin.com/in/jan-kowalski-123456',
  'https://github.com/janowak',
  'https://janowak.pl',
  'https://janowak.dev/portfolio/projekty?lang=pl&ref=cv#kontakt',
  'https://a.io',
  'https://sub.domain.example.co.uk/a/b/c/d/e/f?x=1&y=2',
  'https://example.com/' + 'a'.repeat(98),
  'https://xn--e1afmkfd.xn--p1ai/path',
  'https://example.com/%C5%BC%C3%B3%C5%82w',
  'HTTPS://Example.COM/Path',
  'https://bit.ly/3AbCdEf',
  'https://www.behance.net/jankowalski',
  'https://gitlab.com/group/sub-group/project-name',
  'https://my-site.example.org:8443/cv?token=abc',
  'https://example.com/a_b-c.d~e',
  'https://example.com/?q=1+2&r=%20',
  'https://x.y.z.example.com/' + 'p/'.repeat(40),
  'https://example.com/' + '0123456789'.repeat(9),
  'https://www.xing.com/profile/Jan_Kowalski12',
  'https://kowalski.eu',
  'https://example.com/%C5%9Bcie%C5%BCka',
];

test('QR розкодовується назад у той самий URL (20+ посилань, різні версії)', () => {
  const versions = new Set<number>();
  for (const u of URLS) {
    const v = validateQrUrl(u);
    assert.ok(v.ok, `${u}: ${v.ok ? '' : v.reason}`);
    if (!v.ok) continue;
    const m = qrMatrix(v.url);
    versions.add(m.version);
    assert.equal(decodeMatrix(m), v.url, u);
  }
  assert.ok(URLS.length >= 20);
  assert.ok(versions.size >= 4, `різних версій: ${[...versions].join(',')}`);
});

test('матриця: квадратна, сторона 21 + 4·(версія − 1), версія не вища за 7, детермінована, орієнтири в кутах', () => {
  for (const u of URLS) {
    const m = qrMatrix(u);
    assert.equal(m.modules.length, m.size);
    assert.ok(m.modules.every((r) => r.length === m.size));
    assert.equal(m.size, 21 + 4 * (m.version - 1));
    assert.ok(m.version >= 1 && m.version <= QR_MAX_VERSION, u);
    assert.deepEqual(qrMatrix(u).modules, m.modules);
  }
  const m = qrMatrix('https://example.com');
  for (const [r0, c0] of [[0, 0], [0, m.size - 7], [m.size - 7, 0]] as const) {
    for (let i = 0; i < 7; i++) {
      assert.ok(m.modules[r0][c0 + i] && m.modules[r0 + 6][c0 + i] && m.modules[r0 + i][c0] && m.modules[r0 + i][c0 + 6]);
    }
  }
});

test('текст довший за ліміт не вміщується: помилка замість версії вище 7', () => {
  assert.throws(() => qrMatrix('https://example.com/' + 'x'.repeat(200)));
});

test('випадкові допустимі посилання: матриця без винятків (2000), декодується вибірка (150+)', () => {
  let seed = 12345;
  const rnd = (n: number): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed % n;
  };
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789-._~/?=&%';
  let decoded = 0;
  for (let i = 0; i < 2_000; i++) {
    const host = `${'abcdefghij'.slice(0, 1 + rnd(9))}${rnd(100)}.${['pl', 'com', 'eu', 'dev'][rnd(4)]}`;
    let path = '';
    const len = rnd(QR_URL_MAX - 20 - host.length);
    for (let j = 0; j < len; j++) path += chars[rnd(chars.length)];
    const v = validateQrUrl(`https://${host}/${path}`);
    assert.ok(v.ok, `https://${host}/${path}`);
    if (!v.ok) continue;
    const m = qrMatrix(v.url);
    if (i % 13 === 0) {
      assert.equal(decodeMatrix(m), v.url);
      decoded += 1;
    }
  }
  assert.ok(decoded >= 150);
});

test('валідація: допустиме лишається таким, як ввів користувач; display без https:// і кінцевої /', () => {
  assert.deepEqual(validateQrUrl('  https://www.linkedin.com/in/jan-kowalski/  '), {
    ok: true,
    url: 'https://www.linkedin.com/in/jan-kowalski/',
    display: 'www.linkedin.com/in/jan-kowalski',
  });
  assert.deepEqual(validateQrUrl('https://janowak.pl/'), { ok: true, url: 'https://janowak.pl/', display: 'janowak.pl' });
  assert.deepEqual(validateQrUrl('https://janowak.pl'), { ok: true, url: 'https://janowak.pl', display: 'janowak.pl' });
});

test('валідація: усі відхилення', () => {
  const bad: Array<[string, string]> = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['http://example.com', 'not_https'],
    ['javascript:alert(1)', 'not_https'],
    ['data:text/html,hi', 'not_https'],
    ['mailto:jan@example.com', 'not_https'],
    ['ftp://example.com', 'not_https'],
    ['example.com', 'not_https'],
    ['www.example.com', 'not_https'],
    ['//example.com', 'not_https'],
    ['https://example .com', 'spaces'],
    ['https://example.com/a\nb', 'spaces'],
    ['https://example.com/\u0000', 'spaces'],
    ['https://user:pass@example.com', 'credentials'],
    ['https://user@example.com', 'credentials'],
    ['https://zażółć.pl', 'non_ascii'],
    ['https://example.com/ż', 'non_ascii'],
    ['https://localhost', 'host'],
    ['https://192.168.0.1', 'host'],
    ['https://[::1]/', 'host'],
    ['https://example.123', 'invalid'],
    ['https://-bad-.com', 'host'],
    ['https://', 'invalid'],
    ['https://example.com/' + 'a'.repeat(QR_URL_MAX), 'too_long'],
  ];
  for (const [input, reason] of bad) {
    const v = validateQrUrl(input);
    assert.equal(v.ok, false, input);
    if (!v.ok) assert.equal(v.reason, reason, input);
  }
  // посилання рівно на межі ліміту допустиме й вміщується в QR
  const edge = 'https://example.com/' + 'a'.repeat(QR_URL_MAX - 'https://example.com/'.length);
  assert.equal(edge.length, QR_URL_MAX);
  const ok = validateQrUrl(edge);
  assert.ok(ok.ok);
  if (ok.ok) assert.equal(decodeMatrix(qrMatrix(ok.url)), ok.url);
  assert.equal(QR_LABEL_MAX, 30);
});

test('normalizeExtras: підпис обрізається до 30 символів, посилання зберігається без змін, типи виправляються', () => {
  const long = 'https://example.com/' + 'a'.repeat(300);
  const ex = normalizeExtras({ qr: { enabled: true, url: long, label: 'L'.repeat(100) } });
  assert.equal(ex.qr?.label.length, QR_LABEL_MAX);
  assert.equal(ex.qr?.url, long);
  assert.equal(ex.qr?.enabled, true);
  assert.deepEqual(normalizeExtras({ qr: { enabled: 'tak', url: 5, label: null } }).qr, { enabled: false, url: '', label: '' });
  assert.equal(normalizeExtras({}).qr, undefined);
  // завелике посилання не проходить валідацію, тож не друкується
  assert.equal(validateQrUrl(long).ok, false);
});
