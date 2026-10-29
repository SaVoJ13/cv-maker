import { useMemo, useRef, useState } from 'react';
import type { Cv, TemplateId } from '../domain/types';
import { completeness } from '../domain/completeness';
import { matchesCv, sortCvs, type SortKey } from '../domain/search';
import { useStore } from '../store/StoreProvider';
import { Icon } from './Icon';
import { Thumb } from './Thumb';
import { useToast } from './Toast';
import { Dialog } from './ui';

function formatDate(ts: number, ui: 'pl' | 'en'): string {
  try {
    return new Date(ts).toLocaleDateString(ui === 'pl' ? 'pl-PL' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

/* ---------- dialogi ---------- */

function RenameDialog({ cv, onClose }: { cv: Cv; onClose: () => void }) {
  const { t, update } = useStore();
  const notify = useToast();
  const [value, setValue] = useState(cv.name);
  const input = useRef<HTMLInputElement>(null);
  const save = () => {
    const name = value.trim();
    if (name !== cv.name) {
      update(cv.id, (x) => {
        x.name = name;
      });
      notify(t('renamed'));
    }
    onClose();
  };
  return (
    <Dialog
      title={t('rename_title')}
      onClose={onClose}
      initialFocus={input}
      actions={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="submit" form="rename-form" className="btn primary">
            {t('save')}
          </button>
        </>
      }
    >
      <form
        id="rename-form"
        className="dlg-body"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="f">
          <label htmlFor="rename-input">{t('ver_name')}</label>
          <input
            id="rename-input"
            ref={input}
            type="text"
            value={value}
            autoComplete="off"
            placeholder={t('untitled')}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ cv, onClose }: { cv: Cv; onClose: () => void }) {
  const { t, remove } = useStore();
  const notify = useToast();
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      title={t('del_title')}
      role="alertdialog"
      onClose={onClose}
      initialFocus={cancel}
      badge={
        <span className="dlg-badge bad">
          <Icon name="trash" size={24} />
        </span>
      }
      actions={
        <>
          <button type="button" className="btn" ref={cancel} onClick={onClose}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className="btn danger"
            onClick={() => {
              remove(cv.id);
              onClose();
              notify(t('deleted'));
            }}
          >
            <Icon name="trash" size={16} />
            {t('del_confirm')}
          </button>
        </>
      }
    >
      <div className="dlg-body">
        <p className="dlg-name">{cv.name || t('untitled')}</p>
        <p>{t('del_text')}</p>
      </div>
    </Dialog>
  );
}

/* ---------- karty ---------- */

function Meter({ cv }: { cv: Cv }) {
  const { t } = useStore();
  const { done, total } = completeness(cv);
  return (
    <div className="meter-row">
      <div className="meter" role="img" aria-label={`${t('filled')} ${done}/${total}`}>
        <span style={{ width: `${(done / total) * 100}%` }} data-full={done === total || undefined} />
      </div>
      <span className="meter-label" aria-hidden="true">
        {t('filled')} {done}/{total}
      </span>
    </div>
  );
}

function CvCard({ cv, onOpen, onRename, onDelete }: { cv: Cv; onOpen: (id: string) => void; onRename: () => void; onDelete: () => void }) {
  const { t, ui, duplicate } = useStore();
  const notify = useToast();
  const title = cv.name || t('untitled');
  const who = [cv.data.basics.name, cv.data.basics.title].filter(Boolean).join(' · ');
  return (
    <article className="card cv-card" aria-label={title}>
      <div className="thumb-wrap">
        <Thumb cv={cv} />
        <button type="button" className="thumb-hit" tabIndex={-1} aria-hidden="true" onClick={() => onOpen(cv.id)} />
      </div>
      <div className="cbody">
        <h3 title={title}>{title}</h3>
        {who ? <div className="meta clamp1">{who}</div> : null}
        <div className="chips">
          <span className="chip">{t(`tpl_${cv.tpl}`)}</span>
          <span className="chip">{cv.lang.toUpperCase()}</span>
        </div>
        <Meter cv={cv} />
        <div className="meta">
          {t('updated')}: {formatDate(cv.updated, ui)}
        </div>
      </div>
      <div className="cact">
        <button type="button" className="btn primary grow" onClick={() => onOpen(cv.id)}>
          <Icon name="edit" size={16} />
          {t('edit')}
        </button>
        <button
          type="button"
          className="btn icon"
          title={t('dup')}
          aria-label={`${t('dup')}: ${title}`}
          onClick={() => {
            duplicate(cv.id);
            notify(t('duplicated'));
          }}
        >
          <Icon name="copy" size={17} />
        </button>
        <button type="button" className="btn icon" title={t('rename')} aria-label={`${t('rename')}: ${title}`} onClick={onRename}>
          <Icon name="tag" size={17} />
        </button>
        <button type="button" className="btn icon danger-ghost" title={t('del')} aria-label={`${t('del')}: ${title}`} onClick={onDelete}>
          <Icon name="trash" size={17} />
        </button>
      </div>
    </article>
  );
}

/** Przykład: tylko do obejrzenia (bez edycji, duplikowania i usuwania). Zwarty wiersz: miniatura, opis i jeden przycisk. */
function ExampleCard({ cv, onPreview }: { cv: Cv; onPreview: (id: string) => void }) {
  const { t } = useStore();
  const who = [cv.data.basics.name, cv.data.basics.title].filter(Boolean).join(' · ');
  return (
    <article className="ex-row" aria-label={`${t('example')}: ${cv.name || t('untitled')}`}>
      <div className="ex-thumb">
        <Thumb cv={cv} />
        <button type="button" className="thumb-hit" tabIndex={-1} aria-hidden="true" onClick={() => onPreview(cv.id)} />
      </div>
      <div className="ex-body">
        <span className="badge">{t('example')}</span>
        <h3>{cv.name || t('untitled')}</h3>
        {who ? <p className="meta clamp1">{who}</p> : null}
        <button type="button" className="btn soft sm" onClick={() => onPreview(cv.id)}>
          <Icon name="eye" size={16} />
          {t('sample_open')}
        </button>
      </div>
    </article>
  );
}

/** Wachlarz trzech prawdziwych szablonów na pustym pulpicie: pokazuje, co powstanie, zanim użytkownik cokolwiek wybierze. */
const FAN: readonly TemplateId[] = ['classic', 'modern', 'nordic'];
function TemplateFan({ base }: { base: Cv }) {
  const pages = useMemo(() => FAN.map((tpl) => ({ tpl, cv: { ...base, tpl } as Cv })), [base]);
  return (
    <div className="fan" aria-hidden="true">
      {pages.map(({ tpl, cv }, i) => (
        <div key={tpl} className={`fan-p fan-${i}`}>
          <Thumb cv={cv} />
        </div>
      ))}
    </div>
  );
}

const STEP_ICONS = ['layout', 'edit', 'download'] as const;

/* ---------- ekran ---------- */

export function Dashboard({
  onOpen,
  onPreview,
  onCreate,
  onSettings,
}: {
  onOpen: (id: string) => void;
  onPreview: (id: string) => void;
  onCreate: () => void;
  onSettings: () => void;
}) {
  const { t, ui, cvs } = useStore();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const own = useMemo(() => cvs.filter((c) => !c.example), [cvs]);
  const example = cvs.find((c) => c.example) ?? null;
  const locale = ui === 'pl' ? 'pl-PL' : 'en-GB';
  const shown = useMemo(
    () => sortCvs(own.filter((c) => matchesCv(c, query, t(`tpl_${c.tpl}`))), sort, locale),
    [own, query, sort, locale, t],
  );
  const toolbar = own.length >= 2;
  const filtering = query.trim() !== '';
  const renamingCv = own.find((c) => c.id === renaming) ?? null;
  const deletingCv = own.find((c) => c.id === deleting) ?? null;

  return (
    <div className="dash">
      <div className="ph">
        <div>
          <h1>{t('dash_title')}</h1>
          <p>{t('dash_sub')}</p>
        </div>
        {own.length > 0 ? (
          <button type="button" className="btn primary lg ph-new" onClick={onCreate}>
            <Icon name="plus" size={18} />
            {t('new_cv')}
          </button>
        ) : null}
      </div>

      {own.length === 0 ? (
        <>
          <section className="hero" aria-labelledby="onboard-h">
            {example ? <TemplateFan base={example} /> : null}
            <div className="hero-text">
              <h2 id="onboard-h" className="display">
                {t('empty_title')}
              </h2>
              <p>{t('empty_text')}</p>
              <ol className="steps">
                {(['step1', 'step2', 'step3'] as const).map((k, i) => (
                  <li key={k}>
                    <span className="step-ic" aria-hidden="true">
                      <Icon name={STEP_ICONS[i]} size={20} />
                    </span>
                    <span className="step-t">
                      <span className="step-n" aria-hidden="true">
                        {i + 1}
                      </span>
                      {t(k)}
                    </span>
                  </li>
                ))}
              </ol>
              <button type="button" className="btn primary lg hero-cta" onClick={onCreate}>
                <Icon name="plus" size={20} />
                {t('new_cv')}
              </button>
            </div>
          </section>
          {example ? (
            <section className="example-sec" aria-labelledby="example-h">
              <h2 id="example-h" className="sec-title">
                {t('example')}
              </h2>
              <ExampleCard cv={example} onPreview={onPreview} />
            </section>
          ) : null}
        </>
      ) : (
        <>
          {toolbar ? (
            <div className="toolbar" role="search">
              <div className="search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  value={query}
                  placeholder={t('search_ph')}
                  aria-label={t('search_ph')}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {filtering ? (
                  <button type="button" className="search-x" aria-label={t('search_clear')} onClick={() => setQuery('')}>
                    <Icon name="x" size={16} />
                  </button>
                ) : null}
              </div>
              <div className="sortbox">
                <label htmlFor="sort">{t('sort_label')}</label>
                <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="recent">{t('sort_recent')}</option>
                  <option value="name">{t('sort_name')}</option>
                </select>
              </div>
            </div>
          ) : null}

          {shown.length === 0 ? (
            <div className="empty" role="status">
              <Icon name="search" size={28} />
              <h2>{t('no_results')}</h2>
              <p>{t('no_results_hint')}</p>
              <button type="button" className="btn" onClick={() => setQuery('')}>
                {t('search_clear')}
              </button>
            </div>
          ) : (
            <div className="cards">
              {filtering ? null : (
                <button type="button" className="card add-card" onClick={onCreate}>
                  <span className="add-ic">
                    <Icon name="plus" size={24} />
                  </span>
                  <span className="add-t">{t('new_cv')}</span>
                  <span className="add-s">{t('add_card_sub')}</span>
                </button>
              )}
              {shown.map((cv) => (
                <CvCard key={cv.id} cv={cv} onOpen={onOpen} onRename={() => setRenaming(cv.id)} onDelete={() => setDeleting(cv.id)} />
              ))}
            </div>
          )}

          {example ? (
            <section className="example-sec" aria-labelledby="example-h">
              <h2 id="example-h" className="sec-title">
                {t('example')}
              </h2>
              <ExampleCard cv={example} onPreview={onPreview} />
            </section>
          ) : null}
        </>
      )}

      <aside className="datastrip">
        <Icon name="shield" size={20} />
        <p>{t('local_note')}</p>
        <button type="button" className="btn soft sm" onClick={onSettings}>
          {t('backup_title')}
        </button>
      </aside>

      {renamingCv ? <RenameDialog cv={renamingCv} onClose={() => setRenaming(null)} /> : null}
      {deletingCv ? <DeleteDialog cv={deletingCv} onClose={() => setDeleting(null)} /> : null}
    </div>
  );
}
