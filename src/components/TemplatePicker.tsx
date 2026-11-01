import { useEffect, useMemo, useRef, useState } from 'react';
import type { AccentId, Cv, TemplateId } from '../domain/types';
import { ACCENT_IDS, ACCENTS } from '../domain/constants';
import { TEMPLATES, TEMPLATE_META, type AtsLevel } from '../domain/templates';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { Thumb } from './Thumb';
import { Dialog, Segmented } from './ui';

interface TemplatePickerProps {
  /** CV, na którym pokazujemy wzory: przykład (nowe CV) albo własne CV użytkownika (zmiana szablonu) */
  base: Cv;
  mode: 'new' | 'change';
  onPick: (tpl: TemplateId, accent: AccentId) => void;
  onCancel: () => void;
}

type Filter = 'all' | 'ats' | 'photo';

const ATS_BARS: Record<AtsLevel, number> = { high: 3, medium: 2, low: 1 };

function AtsMeter({ level, withLabel = true }: { level: AtsLevel; withLabel?: boolean }) {
  const { t } = useStore();
  return (
    <span className={`ats ats-${level}`}>
      <span className="ats-bars" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <i key={n} data-on={n <= ATS_BARS[level] || undefined} />
        ))}
      </span>
      {withLabel ? (
        <span>
          ATS: {t(`ats_${level}`)}
        </span>
      ) : null}
    </span>
  );
}

function Tags({ k }: { k: TemplateId }) {
  const { t } = useStore();
  const meta = TEMPLATE_META[k];
  return (
    <>
      {meta.photo ? <span className="tag">{t('tpl_badge_photo')}</span> : null}
      {!meta.atsSafe ? <span className="tag warn">{t('tpl_badge_cols')}</span> : null}
    </>
  );
}

function Facts({ k }: { k: TemplateId }) {
  const { t } = useStore();
  return (
    <dl className="facts">
      <div>
        <dt>{t('pick_for')}</dt>
        <dd>{t(`tpl_for_${k}`)}</dd>
      </div>
      <div>
        <dt>{t('pick_pro')}</dt>
        <dd>{t(`tpl_pro_${k}`)}</dd>
      </div>
      <div>
        <dt>{t('pick_con')}</dt>
        <dd>{t(`tpl_con_${k}`)}</dd>
      </div>
      <div>
        <dt>{t('pick_ats')}</dt>
        <dd>
          <AtsMeter level={TEMPLATE_META[k].ats} />
        </dd>
      </div>
    </dl>
  );
}

/**
 * Galeria szablonów: każdy wzór pokazany jako miniatura prawdziwego dokumentu.
 * Przy nowym CV to dane przykładowe; przy zmianie szablonu: własne dane użytkownika.
 * Wybór jest dwuetapowy (zaznacz, potem „Kontynuuj"), żeby przypadkowe kliknięcie nie tworzyło CV.
 */
export function TemplatePicker({ base, mode, onPick, onCancel }: TemplatePickerProps) {
  const { t } = useStore();
  const [accent, setAccent] = useState<AccentId>(base.accent);
  const [selected, setSelected] = useState<TemplateId>(mode === 'change' ? base.tpl : TEMPLATES[0]);
  const [filter, setFilter] = useState<Filter>('all');
  const [details, setDetails] = useState(false);
  const detailsBtn = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(settle.current), []);

  /* Na telefonie szablony przewija się w poziomie jak karuzelę: ten, który zatrzyma się na środku, zostaje wybrany. */
  const onGridScroll = () => {
    const grid = gridRef.current;
    if (!grid || grid.scrollWidth <= grid.clientWidth + 1) return;
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const mid = grid.getBoundingClientRect().left + grid.clientWidth / 2;
      let best: { k: TemplateId; d: number } | null = null;
      grid.querySelectorAll<HTMLElement>('[data-tpl]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.left + r.width / 2 - mid);
        if (!best || d < best.d) best = { k: el.dataset.tpl as TemplateId, d };
      });
      if (best) setSelected((best as { k: TemplateId }).k);
    }, 120);
  };
  /* przewijamy tylko karuzelę (scrollIntoView ruszałby też stronę w pionie) */
  const centerCard = (k: TemplateId, behavior: ScrollBehavior) => {
    const grid = gridRef.current;
    const el = grid?.querySelector<HTMLElement>(`[data-tpl="${k}"]`);
    if (!grid || !el || grid.scrollWidth <= grid.clientWidth + 1) return;
    grid.scrollTo({ left: el.offsetLeft - (grid.clientWidth - el.offsetWidth) / 2, behavior });
  };
  const choose = (k: TemplateId) => {
    setSelected(k);
    centerCard(k, 'smooth');
  };
  /* przy zmianie szablonu karuzela startuje na obecnym szablonie */
  useEffect(() => {
    centerCard(selected, 'auto');
    // tylko przy otwarciu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previews = useMemo(() => TEMPLATES.map((k) => ({ k, cv: { ...base, tpl: k, accent } as Cv })), [base, accent]);
  const visible = previews.filter(({ k }) => (filter === 'ats' ? TEMPLATE_META[k].atsSafe : filter === 'photo' ? TEMPLATE_META[k].photo : true));

  return (
    <section className="pick" aria-labelledby="pick-title">
      <div className="ph ph-nowrap">
        <div>
          <h1 id="pick-title">{t('pick_title')}</h1>
          <p>{t(mode === 'new' ? 'pick_sub_new' : 'pick_sub_change')}</p>
        </div>
        <button type="button" className="btn" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>

      <div className="pick-layout">
        <div className="pick-main">
          <div className="pick-controls">
            <div className="ctl">
              <span className="ctl-l" id="accent-l">
                {t('pick_accent')}
              </span>
              <div className="swatches" role="group" aria-labelledby="accent-l">
                {ACCENT_IDS.map((k) => (
                  <button key={k} type="button" className="swatch" aria-pressed={accent === k} title={t(`acc_${k}`)} aria-label={t(`acc_${k}`)} onClick={() => setAccent(k)}>
                    <span style={{ background: ACCENTS[k] }} />
                    {accent === k ? <Icon name="check" size={14} /> : null}
                  </button>
                ))}
              </div>
            </div>
            <Segmented<Filter>
              label={t('pick_filter')}
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: t('pick_filter_all') },
                { value: 'ats', label: t('pick_filter_ats') },
                { value: 'photo', label: t('pick_filter_photo') },
              ]}
            />
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <p>{t('pick_none')}</p>
            </div>
          ) : (
            <>
              <p className="pick-swipe">
                <Icon name="arrow-right" size={14} />
                {t('pick_swipe')}
              </p>
              <div className="pickgrid" ref={gridRef} onScroll={onGridScroll}>
                {visible.map(({ k, cv }) => {
                  const meta = TEMPLATE_META[k];
                  const isSel = selected === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      className="pickcard"
                      data-tpl={k}
                      aria-pressed={isSel}
                      aria-label={`${t(`tpl_${k}`)}${mode === 'change' && base.tpl === k ? ` (${t('pick_current')})` : ''}`}
                      onClick={() => choose(k)}
                      onDoubleClick={() => onPick(k, accent)}
                    >
                      <span className="pick-thumb">
                        <Thumb cv={cv} />
                        {isSel ? (
                          <span className="pick-check" aria-hidden="true">
                            <Icon name="check" size={16} />
                          </span>
                        ) : null}
                      </span>
                      <span className="pickbody">
                        <span className="pickname">
                          {t(`tpl_${k}`)}
                          {mode === 'change' && base.tpl === k ? <span className="tag brand">{t('pick_current')}</span> : null}
                        </span>
                        <span className="pickdesc">{t(`tpl_desc_${k}`)}</span>
                        <span className="pickmeta">
                          <AtsMeter level={meta.ats} />
                          <span className="tags">
                            <Tags k={k} />
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <aside className="pick-side" aria-label={t('pick_selected')}>
          <div className="side-thumb" aria-hidden="true">
            <Thumb cv={previews.find((p) => p.k === selected)?.cv ?? base} />
          </div>
          <p className="eyebrow">{t('pick_selected')}</p>
          <h2>{t(`tpl_${selected}`)}</h2>
          <div className="tags">
            <Tags k={selected} />
          </div>
          <p className="side-desc">{t(`tpl_desc_${selected}`)}</p>
          <button type="button" className="btn primary lg block" onClick={() => onPick(selected, accent)}>
            {t('pick_continue')}
            <Icon name="arrow-right" size={18} />
          </button>
          <Facts k={selected} />
        </aside>
      </div>

      <div className="pick-bar">
        <div className="pick-bar-info">
          <span className="eyebrow">{t('pick_selected')}</span>
          <strong>{t(`tpl_${selected}`)}</strong>
        </div>
        <button type="button" className="btn pick-details" ref={detailsBtn} aria-label={t('pick_details')} onClick={() => setDetails(true)}>
          <Icon name="info" size={18} />
          <span className="lbl">{t('pick_details')}</span>
        </button>
        <button type="button" className="btn primary" onClick={() => onPick(selected, accent)}>
          {t('pick_continue')}
          <Icon name="arrow-right" size={18} />
        </button>
      </div>

      {details ? (
        <Dialog
          title={t(`tpl_${selected}`)}
          className="wide"
          onClose={() => setDetails(false)}
          actions={
            <>
              <button type="button" className="btn" onClick={() => setDetails(false)}>
                {t('close')}
              </button>
              <button type="button" className="btn primary" onClick={() => onPick(selected, accent)}>
                {t('pick_continue')}
              </button>
            </>
          }
        >
          <div className="dlg-body">
            <div className="dlg-thumb" aria-hidden="true">
              <Thumb cv={previews.find((p) => p.k === selected)?.cv ?? base} />
            </div>
            <div className="tags">
              <Tags k={selected} />
            </div>
            <p>{t(`tpl_desc_${selected}`)}</p>
            <Facts k={selected} />
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
