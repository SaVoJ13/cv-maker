import type { Cv } from '../domain/types';
import { recruiterTips } from '../domain/quality';
import { useStore } from '../store/StoreProvider';
import { Callout } from './ui';

/** Поради рекрутера під перевіркою якості: м'які підказки, не помилки. */
export function RecruiterTips({ cv }: { cv: Cv }) {
  const { t } = useStore();
  const tips = recruiterTips(cv);
  return (
    <div className="rec" aria-label={t('rec_title')} role="group">
      <h4 className="rec-h">{t('rec_title')}</h4>
      {tips.map((tip) => {
        if (tip.id === 'phone_code') {
          return (
            <Callout key={tip.id} tone="warn">
              {t('rec_phone_code')}
            </Callout>
          );
        }
        if (tip.id === 'metrics_where') {
          return (
            <Callout key={tip.id} tone="warn">
              <p>{t('rec_metrics_intro')}</p>
              <ul className="rec-places">
                {(tip.places ?? []).map((p) => (
                  <li key={p.index}>{[p.role, p.company].filter(Boolean).join(' · ') || `${t('item')} ${p.index + 1}`}</li>
                ))}
              </ul>
              <p>{t('rec_metrics_note')}</p>
            </Callout>
          );
        }
        return (
          <Callout key={tip.id} tone="info">
            <p>
              <strong>{t('rec_law_title')}</strong>
            </p>
            <p>{t('rec_law')}</p>
            <p className="rec-disc">{t('rec_law_disclaimer')}</p>
          </Callout>
        );
      })}
    </div>
  );
}
