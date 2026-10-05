import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Dialog as RDialog, DropdownMenu as RMenu } from 'radix-ui';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from './cn';
import { Button, IconButton, Input, validateRequired } from './primitives';

// ── Dialog ─────────────────────────────────────────────────────────────────
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  trigger,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  trigger?: ReactNode;
}) {
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="th-anim-fade fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px]" />
        <RDialog.Content
          className={cn(
            'th-anim-pop fixed z-50 flex max-h-[min(90dvh,900px)] w-[calc(100vw-1.5rem)] flex-col rounded-lg border border-border bg-raised shadow-md focus:outline-none',
            'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
            widths[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2">
            <div className="min-w-0">
              <RDialog.Title className="text-[15px] font-semibold">{title}</RDialog.Title>
              {description ? (
                <RDialog.Description className="mt-0.5 text-[13px] text-muted">{description}</RDialog.Description>
              ) : (
                <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</RDialog.Description>
              )}
            </div>
            <RDialog.Close asChild>
              <IconButton label="Close" size="sm" className="-mr-2 -mt-1">
                <X className="size-4" />
              </IconButton>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
          {footer && (
            <div
              className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3"
              // The main (primary) button saves: check required fields first, so every dialog gets the same checks.
              onClickCapture={(e) => {
                const btn = (e.target as HTMLElement).closest('button[data-variant="primary"]');
                const dialog = (e.currentTarget as HTMLElement).closest('[role="dialog"]');
                if (btn && dialog && !validateRequired(dialog)) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {footer}
            </div>
          )}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Slide-over panel (detail pane on tablets/phones, notification inbox). */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  side = 'right',
  width = 'w-[min(100vw,440px)]',
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  side?: 'right' | 'left' | 'bottom';
  width?: string;
  footer?: ReactNode;
}) {
  const pos =
    side === 'right'
      ? cn('right-0 top-0 h-dvh th-anim-slide border-l', width)
      : side === 'left'
        ? cn('left-0 top-0 h-dvh th-anim-fade border-r', width)
        : 'bottom-0 left-0 right-0 max-h-[85dvh] rounded-t-lg th-anim-sheet border-t';
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="th-anim-fade fixed inset-0 z-50 bg-black/30" />
        <RDialog.Content className={cn('fixed z-50 flex flex-col border-border bg-raised shadow-md focus:outline-none', pos)}>
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
            <RDialog.Title className="truncate text-[15px] font-semibold">{title}</RDialog.Title>
            <RDialog.Description className="sr-only">{typeof title === 'string' ? title : 'Panel'}</RDialog.Description>
            <RDialog.Close asChild>
              <IconButton label="Close" size="sm">
                <X className="size-4" />
              </IconButton>
            </RDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
  separatorBefore?: boolean;
}

export function Menu({ trigger, items, align = 'end', label }: { trigger: ReactNode; items: (MenuItem | null | false)[]; align?: 'start' | 'end'; label?: ReactNode }) {
  const list = items.filter(Boolean) as MenuItem[];
  return (
    <RMenu.Root>
      <RMenu.Trigger asChild>{trigger}</RMenu.Trigger>
      <RMenu.Portal>
        <RMenu.Content align={align} sideOffset={6} collisionPadding={8} className="th-anim-pop z-50 min-w-48 rounded-lg border border-border bg-raised p-1 shadow-md">
          {label && <RMenu.Label className="px-2.5 py-1.5 text-[11.5px] font-medium uppercase tracking-wide text-faint">{label}</RMenu.Label>}
          {list.map((it, i) => (
            <div key={i}>
              {it.separatorBefore && <RMenu.Separator className="my-1 h-px bg-border" />}
              <RMenu.Item
                disabled={it.disabled}
                onSelect={it.onSelect}
                className={cn(
                  'flex cursor-pointer select-none items-start gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] outline-none data-[highlighted]:bg-bg-subtle data-[disabled]:opacity-50',
                  it.danger && 'text-danger',
                )}
              >
                {it.icon && <span className="mt-0.5 shrink-0 text-muted [&>svg]:size-4">{it.icon}</span>}
                <span className="min-w-0">
                  <span className="block">{it.label}</span>
                  {it.hint && <span className="block text-[12px] text-muted">{it.hint}</span>}
                </span>
              </RMenu.Item>
            </div>
          ))}
        </RMenu.Content>
      </RMenu.Portal>
    </RMenu.Root>
  );
}

// ── Confirm ────────────────────────────────────────────────────────────────
export interface ConfirmOptions {
  title: ReactNode;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Require typing this text to confirm (destructive actions). */
  typeToConfirm?: string;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => window.confirm('Are you sure?'));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const [typed, setTyped] = useState('');
  const confirm = useCallback<ConfirmFn>(
    (o) =>
      new Promise((resolve) => {
        setTyped('');
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const blocked = !!state?.typeToConfirm && typed.trim() !== state.typeToConfirm;
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Dialog
        open={!!state}
        onOpenChange={(v) => !v && close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button onClick={() => close(false)}>Cancel</Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
              {state?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        {state?.body && <div className="text-[13.5px] text-muted">{state.body}</div>}
        {state?.typeToConfirm && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[13px]">
              Type <strong className="font-semibold">{state.typeToConfirm}</strong> to confirm.
            </p>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Confirmation text" autoFocus />
          </div>
        )}
      </Dialog>
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

// ── Toasts ─────────────────────────────────────────────────────────────────
type ToastTone = 'success' | 'error' | 'info' | 'warning';
interface ToastItem {
  id: number;
  tone: ToastTone;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}
let toasts: ToastItem[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let nextId = 1;

function push(tone: ToastTone, message: ReactNode, action?: ToastItem['action']) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, message, action }];
  emit();
  setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000);
}
function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (m: ReactNode, action?: ToastItem['action']) => push('success', m, action),
  error: (m: ReactNode) => push('error', m),
  info: (m: ReactNode, action?: ToastItem['action']) => push('info', m, action),
  warning: (m: ReactNode) => push('warning', m),
};

export function Toaster() {
  const items = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
  );
  const icons = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };
  const tones = { success: 'text-success', error: 'text-danger', info: 'text-info', warning: 'text-warning' };
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5">
      {items.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div key={t.id} className="th-anim-pop pointer-events-auto flex max-w-md items-center gap-2.5 rounded-lg border border-border bg-raised px-3.5 py-2.5 text-[13.5px] shadow-md">
            <Icon className={cn('size-4 shrink-0', tones[t.tone])} />
            <span className="min-w-0 flex-1">{t.message}</span>
            {t.action && (
              <button
                className="font-medium text-accent"
                onClick={() => {
                  t.action!.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button aria-label="Dismiss" onClick={() => dismiss(t.id)} className="text-faint hover:text-fg">
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Returns true when viewport matches the query (responsive layout switching). */
export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    h();
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}
