import { useState, type ReactNode } from 'react';
import { Menu as MenuIcon, ChevronDown, ChevronRight, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from './cn';
import { Button, IconButton } from './primitives';
import { Sheet, useMediaQuery } from './overlays';

/**
 * Spark-like three-zone shell (spec §9.1, §9.5):
 * ≥1200px sidebar + content (content may be a SplitView); 768–1199 collapsible sidebar; <768 slide-over nav.
 */
export function AppShell({
  sidebar,
  mobileTitle,
  mobileActions,
  children,
  banner,
}: {
  sidebar: (close: () => void) => ReactNode;
  mobileTitle?: ReactNode;
  mobileActions?: ReactNode;
  children: ReactNode;
  banner?: ReactNode;
}) {
  const wide = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {wide ? (
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-bg-subtle/60">{sidebar(() => {})}</aside>
      ) : (
        <Sheet open={open} onOpenChange={setOpen} title={mobileTitle ?? 'Menu'} side="left" width="w-[min(86vw,300px)]">
          <div className="flex h-full flex-col">{sidebar(() => setOpen(false))}</div>
        </Sheet>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!wide && (
          <header className="flex h-13 shrink-0 items-center gap-2 border-b border-border bg-surface px-2">
            <IconButton label="Open menu" onClick={() => setOpen(true)}>
              <MenuIcon className="size-5" />
            </IconButton>
            <div className="min-w-0 flex-1 truncate font-semibold">{mobileTitle}</div>
            {mobileActions}
          </header>
        )}
        {banner}
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export function SidebarSection({ title, children, collapsible = true }: { title?: string; children: ReactNode; collapsible?: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="py-1">
      {title && (
        <button
          type="button"
          onClick={() => collapsible && setOpen(!open)}
          className="group flex w-full items-center gap-1 px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint hover:text-muted"
          aria-expanded={open}
        >
          {collapsible && (open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />)}
          {title}
        </button>
      )}
      {open && <div className="space-y-px px-2">{children}</div>}
    </div>
  );
}

export function SidebarItem({
  icon,
  label,
  active,
  count,
  dot,
  onClick,
  as: As = 'button',
  ...rest
}: {
  icon?: ReactNode;
  label: ReactNode;
  active?: boolean;
  count?: number;
  dot?: boolean;
  onClick?: () => void;
  as?: any;
} & Record<string, unknown>) {
  return (
    <As
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors',
        active ? 'bg-accent-soft font-medium text-fg' : 'text-fg/85 hover:bg-bg-subtle',
      )}
      {...rest}
    >
      {icon && <span className={cn('shrink-0 [&>svg]:size-[17px]', active ? 'text-accent' : 'text-muted')}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {dot && <span className="size-1.5 rounded-full bg-accent" />}
      {!!count && <span className={cn('tabular text-[11.5px] font-medium', active ? 'text-accent' : 'text-faint')}>{count > 99 ? '99+' : count}</span>}
    </As>
  );
}

export function PageHeader({
  title,
  icon,
  subtitle,
  actions,
  children,
  className,
}: {
  title: ReactNode;
  icon?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('border-b border-border bg-surface/70 px-4 py-3.5 sm:px-6', className)}>
      <div className="flex flex-wrap items-center gap-3">
        {icon && <span className="grid size-8 place-items-center rounded-md bg-accent-soft text-accent [&>svg]:size-[18px]">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-[12.5px] text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

export function Page({ children, className, width = 'max-w-6xl' }: { children: ReactNode; className?: string; width?: string }) {
  return <div className={cn('mx-auto w-full px-4 py-5 sm:px-6', width, className)}>{children}</div>;
}

/** Friendly empty state: icon, one sentence, one action (spec §9.1). */
export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <span className="mb-3 grid size-11 place-items-center rounded-full bg-bg-subtle text-muted [&>svg]:size-5">{icon}</span>}
      <p className="text-[14px] font-semibold">{title}</p>
      {body && <div className="mt-1 max-w-sm text-[13px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, retry, title = 'Something went wrong' }: { error?: unknown; retry?: () => void; title?: string }) {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : (error as any)?.message;
  return (
    <EmptyState
      icon={<AlertTriangle />}
      title={title}
      body={msg ? <span className="break-words">{msg}</span> : 'Please try again.'}
      action={retry && <Button onClick={retry} icon={<RefreshCw className="size-4" />}>Try again</Button>}
    />
  );
}
