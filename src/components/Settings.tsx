import { Suspense, lazy, type ReactNode } from 'react';
import { adsActive, gateActive, openAdPrivacyOptions } from '../monetization/ads';
import { billingAvailable } from '../monetization/billing';
import { passActive } from '../domain/access';
import { fmt } from '../domain/i18n/fmt';
import { loadAccess } from '../store/accessPersist';
import { browserStorage } from '../store/persist';
import { errorText } from '../export/errors';
import { THEME_PREFS, type ThemePref } from '../domain/theme';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../store/useTheme';
import { BackupBox } from './BackupBox';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';
import { Segmented } from './ui';

const THEME_ICON: Record<ThemePref, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

function Row({ title, desc, children, id, icon }: { title: string; desc?: string; children: ReactNode; id: string; icon: IconName }) {
  return (
    <section className="set-row" aria-labelledby={id}>
      <span className="set-ic" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <div className="set-text">
        <h2 id={id}>{title}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="set-ctl">{children}</div>
    </section>
  );
}

/**
 * Ustawienia: tylko to, co aplikacja naprawdę ma (motyw, kopia zapasowa, zgody na reklamy).
 * Aplikacja nie ma kont ani subskrypcji, więc nie pokazujemy profilu ani planu.
 */
/** Кнопка скидання Pass і реклам існує лише в профілі dev: у closed і production імпорт відкидається при збірці. */
const DevResetButton = import.meta.env.DEV || import.meta.env.MODE === 'dev' ? lazy(() => import('../monetization/DevResetButton').then((m) => ({ default: m.DevResetButton }))) : null;

export function Settings() {
  const { t } = useStore();
  const [theme, setTheme] = useTheme();
  const notify = useToast();

  return (
    <div className="settings">
      <div className="ph">
        <div>
          <h1>{t('set_title')}</h1>
          <p>{t('set_sub')}</p>
        </div>
      </div>

      <div className="set-card">
        <Row id="set-theme" icon={THEME_ICON[theme]} title={t('set_theme_title')} desc={t('set_theme_desc')}>
          <Segmented<ThemePref>
            label={t('set_theme_title')}
            value={theme}
            onChange={setTheme}
            options={THEME_PREFS.map((p) => ({ value: p, label: t(`theme_${p}`), icon: THEME_ICON[p] }))}
          />
        </Row>
        <Row id="set-data" icon="database" title={t('backup_title')} desc={t('backup_desc')}>
          <BackupBox />
        </Row>
        {gateActive() && billingAvailable() ? (
          <Row id="set-pdf" icon="download" title={t('set_pdf_title')} desc={t('gate_offline_note')}>
            <p className="hint" id="passStatus">
              {(() => {
                const a = loadAccess(browserStorage());
                return passActive(a, Date.now()) && a.passUntil !== null
                  ? fmt(t('pass_active'), { date: new Date(a.passUntil).toLocaleDateString() })
                  : t('pass_none');
              })()}
            </p>
            {DevResetButton ? (
              <Suspense fallback={null}>
                <DevResetButton />
              </Suspense>
            ) : null}
          </Row>
        ) : null}
        {adsActive() ? (
          <Row id="set-ads" icon="shield" title={t('set_ads_title')} desc={t('set_ads_desc')}>
            <button
              type="button"
              id="adPrivacy"
              className="btn"
              onClick={() => {
                openAdPrivacyOptions().catch((e: unknown) => notify(`${t('gate_fail')} (${errorText(e).slice(0, 140)})`, 6000, 'error'));
              }}
            >
              <Icon name="shield" size={16} />
              {t('ads_privacy')}
            </button>
          </Row>
        ) : null}
      </div>
    </div>
  );
}
