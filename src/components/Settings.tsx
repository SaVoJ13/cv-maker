import type { ReactNode } from 'react';
import { adsActive, openAdPrivacyOptions } from '../monetization/ads';
import { errorText } from '../export/errors';
import { THEME_PREFS, type ThemePref } from '../domain/theme';
import { useStore } from '../store/StoreProvider';
import { useTheme } from '../store/useTheme';
import { BackupBox } from './BackupBox';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';
import { Segmented } from './ui';

const THEME_ICON: Record<ThemePref, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

function Row({ title, desc, children, id }: { title: string; desc?: string; children: ReactNode; id: string }) {
  return (
    <section className="set-row" aria-labelledby={id}>
      <div className="set-text">
        <h2 id={id}>{title}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="set-ctl">{children}</div>
    </section>
  );
}

/**
 * Ustawienia: tylko to, co aplikacja naprawdę ma (język interfejsu, motyw, kopia zapasowa, zgody na reklamy).
 * Aplikacja nie ma kont ani subskrypcji, więc nie pokazujemy profilu ani planu.
 */
export function Settings() {
  const { t, ui, setUi } = useStore();
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
        <Row id="set-lang" title={t('set_lang_title')} desc={t('set_lang_desc')}>
          <Segmented
            label={t('set_lang_title')}
            value={ui}
            onChange={setUi}
            options={[
              { value: 'pl', label: 'Polski' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Row>
        <Row id="set-theme" title={t('set_theme_title')} desc={t('set_theme_desc')}>
          <Segmented<ThemePref>
            label={t('set_theme_title')}
            value={theme}
            onChange={setTheme}
            options={THEME_PREFS.map((p) => ({ value: p, label: t(`theme_${p}`), icon: THEME_ICON[p] }))}
          />
        </Row>
        <Row id="set-data" title={t('backup_title')} desc={t('backup_desc')}>
          <BackupBox />
        </Row>
        {adsActive() ? (
          <Row id="set-ads" title={t('set_ads_title')} desc={t('set_ads_desc')}>
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
