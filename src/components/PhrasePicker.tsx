import { useState } from 'react';
import type { Cv } from '../domain/types';
import { TEMPLATE_META } from '../domain/templates';
import { INDUSTRY_IDS, phrasesFor, type IndustryId, type PhraseSection } from '../domain/phrases';
import { insertPhrase, isInserted } from '../domain/phrases/insert';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { Dialog, SelectField } from './ui';

const LAST_KEY = 'cvmaker.phraseIndustry';

function loadLast(): IndustryId | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return INDUSTRY_IDS.includes(v as IndustryId) ? (v as IndustryId) : null;
  } catch {
    return null;
  }
}

function saveLast(v: IndustryId) {
  try {
    localStorage.setItem(LAST_KEY, v);
  } catch {
    /* пам'ять недоступна: просто не запам'ятовуємо */
  }
}

/**
 * Кнопка «Wstaw frazę» і вікно з готовими фразами. Текст вставляється мовою документа,
 * назви показуються мовою інтерфейсу. Обмежень Free/PRO немає.
 */
export function PhraseButton({
  cv,
  section,
  idPrefix,
  value,
  onChange,
}: {
  cv: Cv;
  section: PhraseSection;
  /** Унікальний префікс id для кнопки й поля вибору галузі */
  idPrefix: string;
  /** Поточний текст поля */
  value: string;
  onChange: (next: string) => void;
}) {
  const { t, ui } = useStore();
  const [open, setOpen] = useState(false);
  const [industry, setIndustry] = useState<IndustryId>(() => TEMPLATE_META[cv.tpl]?.industry ?? loadLast() ?? 'office');
  const items = phrasesFor(industry, section);

  return (
    <>
      <button type="button" className="btn sm" id={`${idPrefix}_phr`} onClick={() => setOpen(true)}>
        <Icon name="plus" size={14} />
        {t('phr_btn')}
      </button>
      {open ? (
        <Dialog
          title={t('phr_title')}
          className="wide"
          titleId={`${idPrefix}_phr_title`}
          onClose={() => setOpen(false)}
          actions={
            <button type="button" className="btn primary" onClick={() => setOpen(false)}>
              {t('phr_done')}
            </button>
          }
        >
          <p className="hint">{t('phr_hint')}</p>
          <SelectField
            id={`${idPrefix}_phr_industry`}
            label={t('phr_industry')}
            value={industry}
            options={INDUSTRY_IDS.map((i) => ({ value: i, label: t(`ind_${i}` as const) }))}
            onChange={(v) => {
              setIndustry(v as IndustryId);
              saveLast(v as IndustryId);
            }}
          />
          <ul className="phr-list">
            {items.map((p) => {
              const added = isInserted(value, p, cv.lang);
              return (
                <li key={p.id}>
                  <button type="button" className="phr" data-added={added || undefined} disabled={added} onClick={() => onChange(insertPhrase(value, p, cv.lang))}>
                    <span className="phr-t">
                      {p.title[ui]}
                      {added ? (
                        <span className="phr-ok">
                          <Icon name="check" size={14} />
                          {t('phr_added')}
                        </span>
                      ) : null}
                    </span>
                    <span className="phr-x" lang={cv.lang}>
                      {p.text[cv.lang]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialog>
      ) : null}
    </>
  );
}
