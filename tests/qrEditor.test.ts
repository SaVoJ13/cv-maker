import test from 'node:test';
import assert from 'node:assert/strict';
import { blankCv, normalizeCv, sampleCv, duplicateCv } from '../src/domain/cvOps.ts';
import { sectionFilled, sectionIds } from '../src/domain/completeness.ts';
import { TEMPLATES } from '../src/domain/templates.ts';
import { MESSAGES } from '../src/domain/i18n/index.ts';
import { QR_LABEL_MAX, QR_URL_MAX, validateQrUrl, type QrUrlProblem } from '../src/domain/qrUrl.ts';
import { parseBackup, serializeBackup } from '../src/domain/backup.ts';
import { FEATURE_TIER } from '../src/domain/features.ts';
import { isBlank } from '../src/domain/completeness.ts';

const PROBLEMS: QrUrlProblem[] = ['empty', 'too_long', 'spaces', 'not_https', 'non_ascii', 'invalid', 'credentials', 'host'];

test('секція «Kod QR» є в редакторі в усіх 15 шаблонах, після «Dane osobowe»-блоку extra, необов’язкова', () => {
  const cv = blankCv();
  for (const tpl of TEMPLATES) {
    (cv as { tpl: string }).tpl = tpl;
    const ids = sectionIds(cv);
    assert.ok(ids.includes('qr'), tpl);
    assert.equal(ids.indexOf('qr'), ids.indexOf('extra') + 1, tpl);
  }
});

test('крапка «заповнено» для QR залежить від увімкнення й валідного посилання', () => {
  const cv = blankCv();
  assert.equal(sectionFilled(cv, 'qr'), false);
  cv.data.extras.qr = { enabled: true, url: '', label: '' };
  assert.equal(sectionFilled(cv, 'qr'), false);
  cv.data.extras.qr = { enabled: true, url: 'http://example.com', label: '' };
  assert.equal(sectionFilled(cv, 'qr'), false);
  cv.data.extras.qr = { enabled: true, url: 'https://example.com', label: '' };
  assert.equal(sectionFilled(cv, 'qr'), true);
  cv.data.extras.qr = { enabled: false, url: 'https://example.com', label: '' };
  assert.equal(sectionFilled(cv, 'qr'), false);
});

test('нічого не підставляється: нове CV, приклад і gallery-демо без QR', () => {
  assert.equal(blankCv().data.extras.qr, undefined);
  assert.equal(sampleCv().data.extras.qr, undefined);
});

test('тексти UI: усі повідомлення про помилки й підписи є в PL, UA, EN; для кожної причини валідації є текст', () => {
  const keys = ['s_qr', 'h_qr', 'f_qr_on', 'f_qr_url', 'f_qr_url_ph', 'f_qr_limit', 'f_qr_ok', 'f_qr_label', 'f_qr_label_ph', 'f_qr_label_limit', ...PROBLEMS.map((p) => `qr_err_${p}`)];
  for (const lang of ['pl', 'uk', 'en'] as const) {
    for (const k of keys) assert.ok(((MESSAGES[lang] as Record<string, string>)[k] ?? '').trim().length > 0, `${lang}.${k}`);
  }
  for (const [k, v] of Object.entries(MESSAGES.uk)) if (/^(s_qr|h_qr|f_qr|qr_err)/.test(k)) assert.ok(!/[ыэъё]/i.test(v), k);
  assert.match(MESSAGES.pl.f_qr_limit, /120/);
  assert.match(MESSAGES.pl.f_qr_label_limit, new RegExp(String(QR_LABEL_MAX)));
  assert.equal(QR_URL_MAX, 120);
});

test('кожне відхилення валідації має свою причину (редактор показує відповідний текст)', () => {
  const samples: Record<QrUrlProblem, string> = {
    empty: '',
    too_long: 'https://example.com/' + 'a'.repeat(QR_URL_MAX),
    spaces: 'https://exa mple.com',
    not_https: 'http://example.com',
    non_ascii: 'https://example.com/ż',
    invalid: 'https://',
    credentials: 'https://u:p@example.com',
    host: 'https://localhost',
  };
  for (const p of PROBLEMS) {
    const v = validateQrUrl(samples[p]);
    assert.equal(v.ok, false, p);
    if (!v.ok) assert.equal(v.reason, p);
  }
});

test('QR і підпис переживають normalizeCv, дублювання і бекап; зміна шаблону дані не чіпає; завелике посилання не обрізається', () => {
  const cv = blankCv();
  cv.data.extras.qr = { enabled: true, url: 'https://github.com/janowak', label: 'GitHub' };
  const snapshot = JSON.parse(JSON.stringify(cv.data));
  for (const tpl of ['classic', 'student', 'panel']) (cv as { tpl: string }).tpl = tpl;
  assert.deepEqual(cv.data, snapshot);
  assert.deepEqual(normalizeCv(JSON.parse(JSON.stringify(cv)))?.data.extras.qr, snapshot.extras.qr);
  assert.deepEqual(duplicateCv(cv, 'kopia').data.extras.qr, snapshot.extras.qr);
  const back = parseBackup(serializeBackup([cv]));
  assert.ok(back.ok);
  assert.deepEqual(back.cvs[0].data.extras.qr, snapshot.extras.qr);
  const raw = JSON.parse(JSON.stringify(cv)) as Record<string, any>;
  raw.data.extras.qr.label = 'L'.repeat(100);
  raw.data.extras.qr.url = 'https://example.com/' + 'z'.repeat(200);
  const n = normalizeCv(raw)!;
  assert.equal(n.data.extras.qr?.label.length, QR_LABEL_MAX);
  assert.equal(n.data.extras.qr?.url.length, 'https://example.com/'.length + 200);
});

test('QR, який друкується, рахується вмістом (isBlank), а вимкнений чи хибний — ні', () => {
  const cv = blankCv();
  for (const k of ['name', 'title', 'email', 'phone', 'city', 'link', 'address', 'birthDate', 'birthPlace', 'license', 'photo'] as const) cv.data.basics[k] = '';
  assert.equal(isBlank(cv), true);
  cv.data.extras.qr = { enabled: true, url: 'http://example.com', label: '' };
  assert.equal(isBlank(cv), true);
  cv.data.extras.qr = { enabled: false, url: 'https://example.com', label: '' };
  assert.equal(isBlank(cv), true);
  cv.data.extras.qr = { enabled: true, url: 'https://example.com', label: '' };
  assert.equal(isBlank(cv), false);
  assert.equal(normalizeCv(JSON.parse(JSON.stringify(cv)))?.data.extras.qr?.enabled, true);
});

test('features.ts: qr — позначка PRO для Спринту 5, без блокувань у цьому спринті', () => {
  assert.equal(FEATURE_TIER.qr, 'pro');
});
