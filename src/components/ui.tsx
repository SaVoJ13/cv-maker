import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './Icon';

/* ---------- pola formularza ---------- */

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
  disabled?: boolean;
  /** Komunikat o błędzie: pokazujemy go dopiero po opuszczeniu pola, żeby nie krzyczeć w trakcie pisania. */
  error?: string | false;
  hint?: string;
}

export function Field({ id, label, value, onChange, type = 'text', placeholder, disabled, error, hint }: FieldProps) {
  const [touched, setTouched] = useState(false);
  const showError = Boolean(error) && touched;
  const msgId = showError ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`f${showError ? ' invalid' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-invalid={showError || undefined}
        aria-describedby={msgId}
        onBlur={() => setTouched(true)}
        onChange={(e) => onChange(e.target.value)}
      />
      {showError ? (
        <p className="f-msg err" id={`${id}-err`} role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="f-msg" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface AreaProps {
  id: string;
  label?: string;
  /** Nazwa dla czytników ekranu, gdy pole nie ma widocznej etykiety */
  ariaLabel?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  /** Pod polem: licznik znaków; `tone` pokazuje, czy liczba mieści się w zalecanym zakresie */
  counter?: { text: string; ok: boolean };
}

export function Area({ id, label, ariaLabel, value, onChange, rows = 4, counter }: AreaProps) {
  return (
    <div className="f">
      {label ? <label htmlFor={id}>{label}</label> : null}
      <textarea id={id} rows={rows} value={value} aria-label={label ? undefined : ariaLabel} onChange={(e) => onChange(e.target.value)} />
      {counter ? (
        <p className={`f-msg counter${counter.ok ? ' ok' : ''}`} aria-live="off">
          {counter.ok ? <Icon name="check" size={14} /> : null}
          <span>{counter.text}</span>
        </p>
      ) : null}
    </div>
  );
}

interface SelectProps {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function SelectField({ id, label, value, options, onChange }: SelectProps) {
  return (
    <div className="f">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Check({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="chk" htmlFor={id}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

/* ---------- segment (wybór jednej opcji z kilku) ---------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className = '',
}: {
  value: T;
  options: { value: T; label: ReactNode; icon?: IconName; ariaLabel?: string }[];
  onChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div className={`seg ${className}`.trim()} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.ariaLabel} onClick={() => onChange(o.value)}>
          {o.icon ? <Icon name={o.icon} size={16} /> : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- przyciski ---------- */

/** Przycisk wymagający drugiego kliknięcia w ciągu 3 s (zamiast okna confirm()). */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = 'btn sm',
  ariaLabel,
}: {
  label: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={`${className}${armed ? ' armed' : ''}`}
      aria-label={armed ? confirmLabel : ariaLabel}
      title={armed ? confirmLabel : ariaLabel}
      onClick={() => {
        if (armed) {
          clearTimeout(timer.current);
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}

export function ItemTools({
  index,
  count,
  onMove,
  onRemove,
  labels,
}: {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  labels: { up: string; down: string; del: string; sure: string };
}) {
  return (
    <div className="tools">
      <button type="button" className="btn sm icon" title={labels.up} aria-label={labels.up} disabled={index === 0} onClick={() => onMove(-1)}>
        <Icon name="arrow-up" size={16} />
      </button>
      <button
        type="button"
        className="btn sm icon"
        title={labels.down}
        aria-label={labels.down}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <Icon name="arrow-down" size={16} />
      </button>
      <ConfirmButton
        className="btn sm icon danger-ghost"
        label={<Icon name="trash" size={16} />}
        confirmLabel={labels.sure}
        ariaLabel={labels.del}
        onConfirm={onRemove}
      />
    </div>
  );
}

/* ---------- komunikaty ---------- */

export function Callout({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warn' | 'error' | 'good'; children: ReactNode; className?: string }) {
  const icon: IconName = tone === 'warn' || tone === 'error' ? 'alert' : tone === 'good' ? 'check' : 'info';
  return (
    <div className={`callout ${tone} ${className}`.trim()} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

/* ---------- okno dialogowe ---------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dostępne okno modalne: zatrzymuje fokus w środku, zamyka się klawiszem Esc i kliknięciem w tło
 * (chyba że trwa operacja: `busy`), a po zamknięciu oddaje fokus elementowi, który je otworzył.
 */
export function Dialog({
  title,
  children,
  actions,
  onClose,
  busy = false,
  role = 'dialog',
  initialFocus,
  titleId = 'dlg-title',
}: {
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose: () => void;
  busy?: boolean;
  role?: 'dialog' | 'alertdialog';
  initialFocus?: RefObject<HTMLElement | null>;
  titleId?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const live = useRef({ onClose, busy });
  live.current = { onClose, busy };

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    document.documentElement.classList.add('modal-open');
    const el = box.current;
    (initialFocus?.current ?? el?.querySelector<HTMLElement>(FOCUSABLE) ?? el)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!live.current.busy) {
          e.stopPropagation();
          live.current.onClose();
        }
        return;
      }
      if (e.key !== 'Tab' || !el) return;
      const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !el.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !el.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      root?.removeAttribute('inert');
      document.documentElement.classList.remove('modal-open');
      if (opener?.isConnected) opener.focus();
      else document.getElementById('main')?.focus({ preventScroll: true });
    };
    // fokus początkowy ustawiamy tylko raz, przy otwarciu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="dialog" role={role} aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="dlg-act">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}
