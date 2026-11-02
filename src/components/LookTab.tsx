import type { ReactNode } from 'react';
import type { AccentId, DensityId, DocLang, TemplateId } from '../domain/types';
import { ACCENT_IDS, ACCENTS, DENSITY_IDS } from '../domain/constants';
import { TEMPLATES, TEMPLATE_META } from '../domain/templates';
import { qualityChecks } from '../domain/quality';
import { AtsMatchButton } from './AtsMatch';
import { RecruiterTips } from './RecruiterTips';
import { useStore } from '../store/StoreProvider';
import type { TabProps } from './ContentTab';
import { Icon } from './Icon';
import { Callout, Segmented } from './ui';

function Choice<T extends string>({
  value,
  current,
  onPick,
  children,
}: {
  value: T;
  current: T;
  onPick: (v: T) => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="opt" aria-pressed={current === value} onClick={() => onPick(value)}>
      {children}
    </button>
  );
}

export function LookTab({ cv, update, pages, onChangeTemplate }: TabProps & { pages: number; onChangeTemplate: () => void }) {
  const { t } = useStore();
  const checks = qualityChecks(cv, pages);
  const ok = checks.filter((c) => c.ok).length;

  return (
    <div className="look">
      <section className="sec">
        <div className="sh">
          <h3>{t('s_tpl')}</h3>
          <button type="button" className="btn sm" onClick={onChangeTemplate}>
            <Icon name="layout" size={14} />
            {t('open_gallery')}
          </button>
        </div>
        <div className="opts">
          {TEMPLATES.map((k: TemplateId) => (
            <Choice
              key={k}
              value={k}
              current={cv.tpl}
              onPick={(v) =>
                update((x) => {
                  x.tpl = v;
                })
              }
            >
              {t(`tpl_${k}`)}
              {TEMPLATE_META[k].photo ? <span className="tag">{t('tpl_badge_photo')}</span> : null}
              {!TEMPLATE_META[k].atsSafe ? <span className="tag warn">{t('tpl_badge_cols')}</span> : null}
            </Choice>
          ))}
        </div>
        {!TEMPLATE_META[cv.tpl].atsSafe ? <Callout tone="warn">{t('ats_note_panel')}</Callout> : null}
      </section>

      <section className="sec">
        <h3>{t('s_acc')}</h3>
        <div className="opts">
          {ACCENT_IDS.map((k: AccentId) => (
            <Choice
              key={k}
              value={k}
              current={cv.accent}
              onPick={(v) =>
                update((x) => {
                  x.accent = v;
                })
              }
            >
              <span className="sw" style={{ background: ACCENTS[k] }} />
              {t(`acc_${k}`)}
            </Choice>
          ))}
        </div>
      </section>

      <section className="sec">
        <h3>{t('s_dens')}</h3>
        <Segmented<DensityId>
          className="full"
          label={t('s_dens')}
          value={cv.density}
          onChange={(v) =>
            update((x) => {
              x.density = v;
            })
          }
          options={DENSITY_IDS.map((k) => ({ value: k, label: t(`d_${k}`) }))}
        />
      </section>

      <section className="sec">
        <h3>{t('s_dlang')}</h3>
        <Segmented<DocLang>
          className="full"
          label={t('s_dlang')}
          value={cv.lang}
          onChange={(v) =>
            update((x) => {
              x.lang = v;
            })
          }
          options={[
            { value: 'pl', label: 'Polski' },
            { value: 'en', label: 'English' },
          ]}
        />
      </section>

      <section className="sec" id="checks">
        <div className="sh">
          <h3>{t('s_ck')}</h3>
          <span className="score" aria-label={`${ok}/${checks.length}`}>
            {ok}/{checks.length}
          </span>
        </div>
        <div className="meter big" role="presentation">
          <span style={{ width: `${(ok / checks.length) * 100}%` }} data-full={ok === checks.length || undefined} />
        </div>
        <ul className="cklist">
          {checks.map((c) => (
            <li key={c.key} className={c.ok ? 'ok' : 'no'}>
              <span className="dot" aria-hidden="true">
                {c.ok ? <Icon name="check" size={12} /> : '!'}
              </span>
              <span>{t(c.key)}</span>
              <span className="sr-only">{c.ok ? t('sec_done') : t('sec_todo')}</span>
            </li>
          ))}
        </ul>
        <RecruiterTips cv={cv} />
        <p className="hint">{t('ats_note')}</p>
        <AtsMatchButton cv={cv} update={update} />
      </section>
    </div>
  );
}
