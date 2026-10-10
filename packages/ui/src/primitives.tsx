import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Check, Command, Info, AlertTriangle, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'quiet' | 'success';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-sm',
  secondary: 'bg-surface text-fg border border-border hover:bg-bg-subtle shadow-sm',
  ghost: 'text-fg hover:bg-bg-subtle',
  quiet: 'text-muted hover:text-fg hover:bg-bg-subtle',
  soft: 'bg-accent-soft text-accent hover:brightness-95',
  danger: 'bg-danger text-white hover:brightness-110 shadow-sm',
  /** A finished step ("Database updated"). The page background color keeps the text readable on both greens. */
  success: 'bg-success text-bg hover:brightness-105 shadow-sm',
};
const sizes: Record<Size, string> = {
  sm: 'h-8 text-[13px] gap-1.5',
  md: 'h-9 text-sm gap-2',
  lg: 'h-11 text-[15px] gap-2',
};
// Padding is separate so a caller's px-… (icon buttons use px-0) actually applies: cn() doesn't merge classes, and
// with both present the stylesheet order decided, which squeezed icons to 8px.
const padding: Record<Size, string> = { sm: 'px-2.5', md: 'px-3.5', lg: 'px-5' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      data-variant={variant}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150 disabled:opacity-50 select-none [&_svg]:shrink-0',
        variants[variant],
        sizes[size],
        !/(^|\s)px-/.test(className ?? '') && padding[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(function IconButton(
  { label, className, size = 'md', variant = 'ghost', children, ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      title={label}
      variant={variant === 'ghost' ? 'quiet' : variant}
      size={size}
      className={cn(size === 'sm' ? 'w-8 px-0' : size === 'lg' ? 'w-11 px-0' : 'w-9 px-0', className)}
      {...rest}
    >
      {children}
    </Button>
  );
});

/** Inputs fill their container unless the caller sets a width (cn() doesn't merge conflicting classes). */
const w = (c?: string) => (c && /(^|\s)(w-|max-w-|flex-1)/.test(c) ? '' : 'w-full');
const field =
  'rounded-md border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint shadow-sm transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(field, w(className), 'h-9', className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, rows = 4, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(field, w(className), 'py-2 leading-relaxed', className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(field, w(className), 'h-9 pr-8 appearance-none bg-no-repeat', className)} style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center', backgroundSize: '14px' }} {...rest}>
      {children}
    </select>
  );
});
// Lucide 'chevron-down' (24×24) as a background so the native <select> keeps its accessibility and mobile pickers.
const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8e98' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`;

export function Label({ children, htmlFor, className }: { children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn('block text-[13px] font-medium text-fg', className)}>
      {children}
    </label>
  );
}

/** Label + control + hint/error, consistently spaced. Children receive the generated id via render prop or use `id`. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  id,
  optional,
  required,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode | ((id: string) => ReactNode);
  className?: string;
  id?: string;
  /** Shows an "Optional" tag next to the label. */
  optional?: boolean;
  /** Checked by validateRequired() (Save buttons, the wizard's Continue): empty = red box and "Please fill this in." */
  required?: boolean;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const ref = useRef<HTMLDivElement>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !required) return;
    const update = (empty: boolean) => {
      setMissing(empty);
      const c = controlOf(el);
      if (empty) c?.setAttribute('aria-invalid', 'true');
      else c?.removeAttribute('aria-invalid');
    };
    const check = (e: Event) => {
      const empty = isEmptyField(el);
      update(empty);
      if (empty) (e as CustomEvent<{ missing: HTMLElement[] }>).detail.missing.push(el);
    };
    const clear = () => !isEmptyField(el) && update(false);
    el.addEventListener('th:check', check);
    el.addEventListener('input', clear);
    el.addEventListener('change', clear);
    return () => {
      el.removeEventListener('th:check', check);
      el.removeEventListener('input', clear);
      el.removeEventListener('change', clear);
    };
  }, [required]);
  const message = error ?? (missing ? 'Please fill this in.' : null);
  return (
    <div ref={ref} data-th-required={required || undefined} className={cn('space-y-1.5', className)}>
      {label && (
        <Label htmlFor={fid}>
          {label}
          {optional && <OptionalTag />}
        </Label>
      )}
      {typeof children === 'function' ? children(fid) : children}
      {message ? (
        <p className="text-[12.5px] text-danger" role="alert">
          {message}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** The one way to mark a field as optional. */
export function OptionalTag() {
  return <span className="ml-1.5 text-[11.5px] font-normal text-faint">Optional</span>;
}

const controlOf = (el: Element) => el.querySelector<HTMLElement>('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select');
const isEmptyField = (el: Element) => {
  const c = controlOf(el) as HTMLInputElement | null;
  return !!c && !c.disabled && !String(c.value ?? '').trim();
};

/**
 * Checks every `<Field required>` in the open dialog (or `root`, or the page): marks empty ones, focuses the first.
 * Call it first in Save handlers: `if (!validateRequired()) return;`
 */
export function validateRequired(root?: ParentNode | null): boolean {
  const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
  const scope: ParentNode = root ?? dialogs[dialogs.length - 1] ?? document;
  const missing: HTMLElement[] = [];
  scope.querySelectorAll('[data-th-required]').forEach((el) => el.dispatchEvent(new CustomEvent('th:check', { detail: { missing } })));
  if (!missing.length) return true;
  missing[0].scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  controlOf(missing[0])?.focus({ preventScroll: true });
  return false;
}

/** Native checkbox, styled (no Radix: keeps the core bundle small). Supports an indeterminate state. */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  id,
  size = 'md',
  className,
}: {
  checked: boolean | 'indeterminate';
  onChange: (v: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
  id?: string;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const auto = useId();
  const cid = id ?? auto;
  const on = checked === true;
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className={cn('relative grid shrink-0 place-items-center', size === 'lg' ? 'size-7' : 'size-[18px]')}>
        <input
          id={cid}
          type="checkbox"
          checked={on}
          ref={(el) => {
            if (el) el.indeterminate = checked === 'indeterminate';
          }}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            'peer absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface transition-colors checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
            size === 'lg' ? 'rounded-md' : 'rounded-[5px]',
          )}
        />
        <Check aria-hidden className={cn('pointer-events-none relative text-accent-fg opacity-0 peer-checked:opacity-100', size === 'lg' ? 'size-5' : 'size-3.5')} strokeWidth={3} />
      </span>
      {label && (
        <label htmlFor={cid} className="cursor-pointer select-none text-sm">
          {label}
        </label>
      )}
    </span>
  );
}

/** Native checkbox with switch styling and role="switch". */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      {label && (
        <label htmlFor={id} className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          {description && <span className="block text-[12.5px] text-muted">{description}</span>}
        </label>
      )}
      <span className="relative inline-flex h-6 w-10 shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full bg-border-strong transition-colors checked:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
      </span>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
  title?: string;
}) {
  const tones = {
    neutral: 'bg-bg-subtle text-muted border-border',
    accent: 'bg-accent-soft text-accent border-transparent',
    success: 'bg-success-soft text-success border-transparent',
    warning: 'bg-warning-soft text-warning border-transparent',
    danger: 'bg-danger-soft text-danger border-transparent',
    info: 'bg-info-soft text-info border-transparent',
  };
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium leading-4 whitespace-nowrap', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Card({ children, className, as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: any } & Record<string, unknown>) {
  return (
    <As className={cn('rounded-lg border border-border bg-surface shadow-sm', className)} {...rest}>
      {children}
    </As>
  );
}

export function CardHeader({ title, action, subtitle, icon }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
      <div className="min-w-0 flex items-center gap-2">
        {icon && <span className="shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-[13.5px] font-semibold">{title}</h3>
          {subtitle && <p className="truncate text-[12.5px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex text-muted', className)}>
      <Loader2 className="size-5 animate-spin" />
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-bg-subtle', className)} />;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The platform modifier key: the Command icon on Apple devices, “Ctrl” elsewhere. */
export function ModKey() {
  return isMac ? <Command className="size-3" aria-label="Command" /> : <>Ctrl</>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded border border-border bg-bg-subtle px-1 font-sans text-[11px] text-muted">{children}</kbd>;
}

export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle }[tone];
  const tones = {
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-md px-3.5 py-2.5', tones[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1 text-[13px] text-fg">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** Pill-style segmented control (view switchers, visibility choice). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    // Below desktop width, choices that don't fit scroll sideways instead of squeezing their labels onto several lines.
    <div role="radiogroup" className={cn('inline-flex rounded-md border border-border bg-bg-subtle p-0.5 relative max-lg:max-w-full max-lg:overflow-x-auto max-lg:[scrollbar-width:none]', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[calc(var(--th-radius-md)-2px)] font-medium text-muted transition-colors hover:text-fg max-lg:shrink-0 max-lg:whitespace-nowrap',
            size === 'sm' ? 'h-7 px-2 text-[12.5px]' : 'h-8 px-3 text-[13px]',
            value === o.value && 'bg-accent-soft text-fg shadow-sm ring-1 ring-accent/60',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; autoFocus?: boolean }) {
  return (
    <div className={cn('relative', className)}>
      <svg aria-hidden viewBox="0 0 16 16" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <Input type="search" value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" aria-label={placeholder} />
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-border', className)} />;
}

/** Classes for a link styled as a button (e.g. <Link className={buttonClass('primary')}>). */
export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string): string {
  return cn(
    'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors duration-150 select-none [&_svg]:shrink-0',
    variants[variant],
    sizes[size],
    !/(^|\s)px-/.test(extra ?? '') && padding[size],
    extra,
  );
}
