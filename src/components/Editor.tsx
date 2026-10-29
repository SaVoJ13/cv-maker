import { useCallback, useState, type KeyboardEvent } from 'react';
import type { Cv } from '../domain/types';
import type { SectionId } from '../domain/completeness';
import { errorText } from '../export/errors';
import { downloadPdf } from '../export/exportPdf';
import { AdGateDialog } from '../monetization/AdGateDialog';
import { useExportGate } from '../monetization/useExportGate';
import { useCvUpdater, useSaveStatus, useStore } from '../store/StoreProvider';
import { useBackup } from './BackupBox';
import { ContentTab } from './ContentTab';
import { Icon, Spinner } from './Icon';
import { LookTab } from './LookTab';
import { useSavedFile } from './SavedFile';
import { Preview } from './Preview';
import { useToast } from './Toast';
import { Callout } from './ui';

type Tab = 'content' | 'look';
type Pane = 'form' | 'prev';

function SaveBadge() {
  const { t } = useStore();
  const status = useSaveStatus();
  return (
    <span className={`save ${status}`} role="status" id="saveState">
      <Icon name={status === 'error' ? 'alert' : status === 'saving' ? 'cloud' : 'check'} size={15} />
      <span>{t(`save_${status}`)}</span>
    </span>
  );
}

export function Editor({ cv, onBack, onChangeTemplate }: { cv: Cv; onBack: () => void; onChangeTemplate: () => void }) {
  const { t } = useStore();
  const notify = useToast();
  const showSaved = useSavedFile();
  const update = useCvUpdater(cv.id);
  const status = useSaveStatus();
  const backup = useBackup();
  const [tab, setTab] = useState<Tab>('content');
  const [pane, setPane] = useState<Pane>('form');
  const [openSec, setOpenSec] = useState<SectionId | null>('basics');
  const [pages, setPages] = useState(1);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const gate = useExportGate();

  const onPages = useCallback((n: number) => setPages(n), []);

  const runExport = async (useCredit: boolean) => {
    setPdfBusy(true);
    try {
      const saved = await downloadPdf(cv);
      if (useCredit) gate.consume();
      if (saved) showSaved(saved);
      else notify(t('pdf_saved'));
    } catch (e) {
      console.error(e);
      notify(`${t('pdf_fail')} (${errorText(e).slice(0, 140)})`, 9000, 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const exportPdf = async () => {
    if (pdfBusy) return;
    const decision = gate.decide();
    if (decision === 'needs-ad') {
      setGateOpen(true);
      return;
    }
    await runExport(decision === 'credit');
  };

  /** Reklama obejrzona: dopisujemy kredyt i od razu pobieramy PDF (kredyt znika po udanym zapisie). */
  const adWatched = () => {
    gate.grant();
    setGateOpen(false);
    void runExport(true);
  };

  const tabs: Tab[] = ['content', 'look'];
  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next = tabs[(tabs.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
  };

  const pdfLabel = pdfBusy ? t('pdf_busy') : t('pdf');
  const pdfIcon = pdfBusy ? <Spinner /> : <Icon name="download" size={17} />;

  return (
    <div className="ed" data-pane={pane}>
      <div className="edbar">
        <div className="edbar-in">
          <button type="button" className="btn ghost back" onClick={onBack} aria-label={t('back')}>
            <Icon name="arrow-left" size={18} />
            <span className="lbl">{t('back')}</span>
          </button>
          <div className="f name-f">
            <label htmlFor="cvname">{t('ver_name')}</label>
            <input
              id="cvname"
              type="text"
              value={cv.name}
              autoComplete="off"
              placeholder={t('untitled')}
              onChange={(e) =>
                update((x) => {
                  x.name = e.target.value;
                })
              }
            />
          </div>
          <SaveBadge />
          <span className="spacer" />
          <button type="button" id="tplBtn" className="btn" onClick={onChangeTemplate} aria-label={t('change_tpl')} title={t('change_tpl')}>
            <Icon name="layout" size={17} />
            <span className="lbl">{t('change_tpl')}</span>
          </button>
          <button type="button" id="pdfBtn" className="btn primary pdf-desktop" disabled={pdfBusy} onClick={() => void exportPdf()}>
            {pdfIcon}
            {pdfLabel}
          </button>
        </div>
      </div>

      {status === 'error' ? (
        <Callout tone="error" className="save-alert">
          <p>
            <strong>{t('save_error_title')}</strong> {t('save_error_hint')}
          </p>
          {backup.hasOwn ? (
            <button type="button" className="btn sm" onClick={() => void backup.save()}>
              <Icon name="download" size={14} />
              {t('backup_save')}
            </button>
          ) : null}
          {backup.hasOwn ? (
            <button type="button" className="btn sm" onClick={() => void backup.save()}>
              <Icon name="download" size={14} />
              {t('backup_save')}
            </button>
          ) : null}
        </Callout>
      ) : null}

      <div className="edgrid">
        <div className="colform">
          <div className="tabs" role="tablist" aria-label={t('ver_name')} onKeyDown={onTabKey}>
            {tabs.map((k) => (
              <button
                key={k}
                type="button"
                id={`tab-${k}`}
                role="tab"
                aria-selected={tab === k}
                aria-controls={`panel-${k}`}
                tabIndex={tab === k ? 0 : -1}
                onClick={() => setTab(k)}
              >
                <Icon name={k === 'content' ? 'file' : 'sliders'} size={16} />
                {t(`tab_${k}`)}
              </button>
            ))}
          </div>
          <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {tab === 'content' ? <ContentTab cv={cv} update={update} open={openSec} onOpen={setOpenSec} /> : null}
            {tab === 'look' ? <LookTab cv={cv} update={update} pages={pages} onChangeTemplate={onChangeTemplate} /> : null}
          </div>
        </div>
        <div className="col-prev">
          <Preview
            cv={cv}
            onPages={onPages}
            onPhotoCrop={(c) =>
              update((x) => {
                x.data.basics.photoX = c.x;
                x.data.basics.photoY = c.y;
                x.data.basics.photoZoom = c.zoom;
              })
            }
          />
        </div>
      </div>

      <div className="edbottom">
        <div className="seg panes" role="group" aria-label={t('pane_label')}>
          {(['form', 'prev'] as Pane[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={pane === p}
              onClick={() => {
                setPane(p);
                window.scrollTo(0, 0);
              }}
            >
              <Icon name={p === 'form' ? 'edit' : 'eye'} size={16} />
              {t(p === 'form' ? 'pane_form' : 'pane_prev')}
            </button>
          ))}
        </div>
        <button type="button" id="pdfBtnBar" className="btn primary" disabled={pdfBusy} onClick={() => void exportPdf()}>
          {pdfIcon}
          {pdfLabel}
        </button>
      </div>

      {gateOpen ? <AdGateDialog onWatched={adWatched} onClose={() => setGateOpen(false)} /> : null}
    </div>
  );
}
