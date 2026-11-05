import { resetAccess } from '../domain/access';
import { saveAccess } from '../store/accessPersist';
import { browserStorage } from '../store/persist';

/** Знак для scripts/check-prod.mjs: у збірках closed і production цього рядка бути не може. */
export const DEV_RESET_MARKER = 'CVMAKER_DEV_RESET_BUTTON_DEV_ONLY';

/** Підпис кнопки: інструмент розробника, лише польською (не входить до словників інтерфейсу). */
export const DEV_RESET_LABEL = 'Resetuj Pass i reklamy';

/** Скидає лише `cvmaker.access`; CV, налаштування й згоду UMP не чіпає. Потім перезавантажує сторінку, щоб стан у пам'яті збігся зі сховищем. */
export function DevResetButton() {
  return (
    <button
      type="button"
      id="devResetAccess"
      className="btn"
      data-dev={DEV_RESET_MARKER}
      onClick={() => {
        saveAccess(browserStorage(), resetAccess());
        location.reload();
      }}
    >
      {DEV_RESET_LABEL}
    </button>
  );
}
