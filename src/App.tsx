import { useEffect, useMemo, useRef, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { Editor } from './components/Editor';
import { Icon } from './components/Icon';
import { SampleView } from './components/SampleView';
import { Settings } from './components/Settings';
import { TemplatePicker } from './components/TemplatePicker';
import { Segmented } from './components/ui';
import { sampleCv } from './domain/cvOps';
import { SavedFileProvider } from './components/SavedFile';
import { ToastProvider } from './components/Toast';
import { StoreProvider, useStore } from './store/StoreProvider';

type View = 'dash' | 'edit' | 'sample' | 'pick-new' | 'pick-change' | 'settings';

function Shell() {
  const { t, ui, setUi, cvs, currentId, select, create, update } = useStore();
  /* Przykład jest tylko do obejrzenia, więc nie otwieramy go w edytorze */
  const current = cvs.find((c) => c.id === currentId && !c.example) ?? null;
  const [sampleId, setSampleId] = useState<string | null>(null);
  const sampleCvShown = cvs.find((c) => c.id === sampleId && c.example) ?? null;
  const [view, setView] = useState<View>('dash');
  const showEditor = view === 'edit' && current !== null;
  const sample = useMemo(() => sampleCv(), []);
  const mainRef = useRef<HTMLElement>(null);
  const firstView = useRef(true);

  const go = (next: View) => {
    setView(next);
    window.scrollTo(0, 0);
  };

  /* Po zmianie ekranu fokus trafia na treść, żeby czytnik ekranu i klawiatura nie zostawały w poprzednim widoku. */
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [view]);

  const preview = (id: string) => {
    setSampleId(id);
    go('sample');
  };

  const open = (id: string) => {
    select(id);
    go('edit');
  };

  const inEditor = showEditor;
  const tab = view === 'settings' ? 'settings' : view === 'pick-new' || view === 'pick-change' ? 'new' : 'home';

  return (
    <div className={`app${inEditor ? ' app-edit' : ''}${view === 'pick-new' || view === 'pick-change' ? ' app-pick' : ''}`}>
      <a className="skip" href="#main" onClick={(e) => (e.preventDefault(), mainRef.current?.focus())}>
        {t('skip')}
      </a>

      {inEditor ? null : (
        <header className="appbar">
          <div className="appbar-in">
            <button type="button" className="brand" onClick={() => go('dash')} aria-label={`CV Maker: ${t('nav_dash')}`}>
              <span className="logo" aria-hidden="true">
                CV
              </span>
              <span className="brand-name">CV Maker</span>
            </button>
            <nav className="nav" aria-label={t('main_nav')}>
              <button type="button" className="nav-link" aria-current={view === 'dash' || view === 'sample' ? 'page' : undefined} onClick={() => go('dash')}>
                {t('nav_dash')}
              </button>
              {current ? (
                <button type="button" className="nav-link" onClick={() => go('edit')}>
                  {t('nav_edit')}
                </button>
              ) : null}
              <button type="button" className="nav-link" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
                {t('nav_settings')}
              </button>
            </nav>
            <span className="spacer" />
            <Segmented
              className="lang-seg"
              label={t('lang_label')}
              value={ui}
              onChange={setUi}
              options={[
                { value: 'pl', label: 'PL', ariaLabel: 'Polski' },
                { value: 'en', label: 'EN', ariaLabel: 'English' },
              ]}
            />
          </div>
        </header>
      )}

      <main id="main" ref={mainRef} tabIndex={-1} className={inEditor ? 'workspace' : 'page'}>
        {view === 'sample' && sampleCvShown ? (
          <SampleView cv={sampleCvShown} onBack={() => go('dash')} onCreate={() => go('pick-new')} />
        ) : view === 'pick-new' ? (
          <TemplatePicker base={sample} mode="new" onCancel={() => go('dash')} onPick={(tpl, accent) => open(create({ tpl, accent }))} />
        ) : view === 'pick-change' && current ? (
          <TemplatePicker
            base={current}
            mode="change"
            onCancel={() => go('edit')}
            onPick={(tpl, accent) => {
              update(current.id, (x) => {
                x.tpl = tpl;
                x.accent = accent;
              });
              go('edit');
            }}
          />
        ) : view === 'settings' ? (
          <Settings />
        ) : showEditor && current ? (
          <Editor key={current.id} cv={current} onBack={() => go('dash')} onChangeTemplate={() => go('pick-change')} />
        ) : (
          <Dashboard onOpen={open} onPreview={preview} onCreate={() => go('pick-new')} onSettings={() => go('settings')} />
        )}
      </main>

      {inEditor ? null : (
        <nav className="bottomnav" aria-label={t('main_nav')}>
          <button type="button" className="bn-item" aria-current={tab === 'home' ? 'page' : undefined} onClick={() => go('dash')}>
            <Icon name="home" size={22} />
            <span>{t('nav_dash')}</span>
          </button>
          <button type="button" className="bn-item bn-new" aria-current={tab === 'new' ? 'page' : undefined} onClick={() => go('pick-new')}>
            <span className="bn-fab">
              <Icon name="plus" size={24} />
            </span>
            <span>{t('new_cv')}</span>
          </button>
          <button type="button" className="bn-item" aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
            <Icon name="sliders" size={22} />
            <span>{t('nav_settings')}</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <SavedFileProvider>
          <Shell />
        </SavedFileProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
