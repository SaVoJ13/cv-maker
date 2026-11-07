import { formatPassDate, passActive } from '../domain/access';
import { fmt } from '../domain/i18n/fmt';
import { browserStorage } from '../store/persist';
import { loadAccess } from '../store/accessPersist';
import { useStore } from '../store/StoreProvider';
import { gateActive } from './ads';
import { billingAvailable } from './billing';

/**
 * Короткий сірий рядок під кнопкою «Pobierz PDF»: що потрібно для експорту (або «Pass aktywny do …»).
 * Лише коли замок діє. Стан Pass читається при кожному рендері редактора.
 */
export function PdfHint() {
  const { t } = useStore();
  if (!gateActive()) return null;
  const a = loadAccess(browserStorage());
  const active = billingAvailable() && passActive(a, Date.now()) && a.passUntil !== null;
  return (
    <span className="pdf-hint" id="pdfHint">
      {active ? fmt(t('pass_active'), { date: formatPassDate(a.passUntil!) }) : t(billingAvailable() ? 'pdf_hint' : 'pdf_hint_ads')}
    </span>
  );
}
