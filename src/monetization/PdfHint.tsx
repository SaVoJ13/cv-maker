import { useStore } from '../store/StoreProvider';
import { gateActive } from './ads';
import { billingAvailable } from './billing';

/** Короткий сірий рядок під кнопкою «Pobierz PDF»: що потрібно для експорту. Лише коли замок діє. */
export function PdfHint() {
  const { t } = useStore();
  if (!gateActive()) return null;
  return (
    <span className="pdf-hint" id="pdfHint">
      {t(billingAvailable() ? 'pdf_hint' : 'pdf_hint_ads')}
    </span>
  );
}
