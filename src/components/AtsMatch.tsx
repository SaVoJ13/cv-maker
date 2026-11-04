import { useDeferredValue, useMemo, useRef, useState } from 'react';
import type { Cv } from '../domain/types';
import type { MsgKey } from '../domain/i18n';
import { scanAts, type AtsHint, type AtsKeyword } from '../domain/atsScanner';
import { insertText } from '../domain/phrases/insert';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { Callout, Dialog } from './ui';

const HINT_KEY: Record<AtsHint, MsgKey> = {
  too_short: 'ats_h_too_short',
  no_keywords: 'ats_h_no_keywords',
  mixed_lang: 'ats_h_mixed_lang',
  doc_lang_differs: 'ats_h_doc_lang_differs',
  low_score: 'ats_h_low_score',
};

const LANG_KEY = { pl: 'ats_lang_pl', en: 'ats_lang_en', mixed: 'ats_lang_mixed' } as const;

/** Хто з підказок інформує (info), а хто просить уваги (warn). */
const HINT_TONE: Record<AtsHint, 'info' | 'warn'> = {
  too_short: 'warn',
  no_keywords: 'warn',
  mixed_lang: 'info',
  doc_lang_differs: 'info',
  low_score: 'info',
};

/**
 * Екран «Dopasuj do oferty». Текст оголошення живе лише в стані цього компонента:
 * не пишеться ні в localStorage, ні в резервну копію, ні в мережу.
 */
export function AtsMatchButton({ cv, update }: { cv: Cv; update: (mutate: (draft: Cv) => void) => void }) {
  const { t } = useStore();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="ats-entry">
        <p className="hint">{t('ats_btn_hint')}</p>
        <button type="button" id="atsBtn" className="btn" onClick={() => setOpen(true)}>
          <Icon name="search" size={16} />
          {t('ats_btn')}
        </button>
      </div>
      {open ? <AtsMatchDialog cv={cv} update={update} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AtsMatchDialog({ cv, update, onClose }: { cv: Cv; update: (mutate: (draft: Cv) => void) => void; onClose: () => void }) {
  const { t } = useStore();
  const [job, setJob] = useState('');
  const [live, setLive] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const deferred = useDeferredValue(job);
  const hasText = job.trim().length > 0;

  const result = useMemo(
    () => (deferred.trim() ? scanAts(deferred, cv.data, { docLang: cv.lang, tpl: cv.tpl }) : null),
    // перераховуємо, коли змінилися лише поля, що впливають на збіг
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferred, cv.data, cv.lang],
  );

  const missingSkills = result?.missing.filter((k) => k.addTo === 'skillsHard' || k.addTo === 'skillsSoft') ?? [];
  const missingReq = result?.missing.filter((k) => k.kind === 'requirement') ?? [];

  const add = (k: AtsKeyword) => {
    update((x) => {
      if (k.addTo === 'skillsHard') x.data.skillsHard = insertText('skills', x.data.skillsHard, k.display);
      else if (k.addTo === 'skillsSoft') x.data.skillsSoft = insertText('skills', x.data.skillsSoft, k.display);
    });
    setLive(`${t('ats_added_live')}: ${k.display}`);
    // кнопка зникає зі списку, тому повертаємо фокус у список
    requestAnimationFrame(() => listRef.current?.focus());
  };

  const score = result?.score ?? null;

  return (
    <Dialog
      title={t('ats_title')}
      className="wide ats-dlg"
      titleId="ats_title"
      onClose={onClose}
      actions={
        <button type="button" className="btn primary" onClick={onClose}>
          {t('ats_done')}
        </button>
      }
    >
      {/* Оцінка завжди на початку екрана, поза областю прокрутки */}
      <div className="ats-score" aria-live="polite">
        <div className="ats-score-row">
          <span className="ats-pct" data-empty={score === null || undefined}>
            {score === null ? '—' : `${score}%`}
          </span>
          <span className="ats-score-label">{t('ats_score_label')}</span>
        </div>
        <div className="meter" role="presentation">
          <span style={{ width: `${score ?? 0}%` }} data-full={score === 100 || undefined} />
        </div>
        <p className="ats-note">{score === null ? t('ats_score_empty') : t('ats_score_note')}</p>
      </div>

      <div className="ats-scroll">
        {hasText ? null : <p className="hint">{t('ats_intro')}</p>}
        <div className="f">
          <div className="ats-fh">
            <label htmlFor="ats_job">{t('ats_field')}</label>
            {hasText ? (
              <button type="button" className="btn sm ghost" onClick={() => setJob('')}>
                {t('ats_clear')}
              </button>
            ) : null}
          </div>
          <textarea
            id="ats_job"
            rows={hasText ? 3 : 6}
            value={job}
            placeholder={t('ats_placeholder')}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => setJob(e.target.value)}
          />
        </div>

        {result ? (
          <div className="ats-res" ref={listRef} tabIndex={-1}>
            <p className="ats-lang">
              {t('ats_lang')}: <b>{t(LANG_KEY[result.jobLang])}</b>
            </p>

            {result.hints.map((h) => (
              <Callout key={h} tone={HINT_TONE[h]}>
                {t(HINT_KEY[h])}
              </Callout>
            ))}

            {missingSkills.length > 0 ? (
              <section aria-labelledby="ats_miss_h">
                <h3 id="ats_miss_h">{t('ats_missing')}</h3>
                <p className="hint">{t('ats_missing_hint')}</p>
                <ul className="ats-list">
                  {missingSkills.map((k) => (
                    <li key={k.stem} className="ats-item">
                      <span className="ats-word">
                        {k.display}
                        <span className="ats-tag">{t(k.addTo === 'skillsSoft' ? 'ats_kind_soft' : 'ats_kind_hard')}</span>
                      </span>
                      <button type="button" className="btn ats-add" aria-label={`${t('ats_add')}: ${k.display}`} title={t('ats_add')} onClick={() => add(k)}>
                        <Icon name="plus" size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : result.matched.length + result.missing.length > 0 && missingReq.length === 0 ? (
              <p className="hint">{t('ats_missing_none')}</p>
            ) : null}

            {missingReq.length > 0 ? (
              <section aria-labelledby="ats_req_h">
                <h3 id="ats_req_h">{t('ats_req')}</h3>
                <p className="hint ats-req-note">{t('ats_req_note')}</p>
                <ul className="ats-chips">
                  {missingReq.map((k) => (
                    <li key={k.stem}>{k.display}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.matched.length + result.missing.length > 0 ? (
              <section aria-labelledby="ats_found_h">
                <h3 id="ats_found_h">{t('ats_found')}</h3>
                {result.matched.length > 0 ? (
                  <ul className="ats-chips ok">
                    {result.matched.map((k) => (
                      <li key={k.stem}>
                        <Icon name="check" size={13} />
                        {k.display}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="hint">{t('ats_found_none')}</p>
                )}
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="sr-only" role="status">
        {live}
      </p>
    </Dialog>
  );
}
