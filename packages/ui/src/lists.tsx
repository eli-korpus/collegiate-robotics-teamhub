import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './primitives';
import { Sheet, useMediaQuery } from './overlays';

const STATUS_TONES: Record<string, string> = {
  neutral: 'bg-bg-subtle text-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

/** List + detail panes. On narrow screens the detail opens as a slide-over. */
export function SplitView({
  list,
  detail,
  detailTitle,
  onCloseDetail,
  listWidth = 'w-[400px]',
  empty,
}: {
  list: ReactNode;
  detail: ReactNode | null;
  detailTitle?: ReactNode;
  onCloseDetail: () => void;
  listWidth?: string;
  empty?: ReactNode;
}) {
  const wide = useMediaQuery('(min-width: 1200px)');
  if (wide) {
    return (
      <div className="flex h-full min-h-0">
        <div className={cn('shrink-0 overflow-y-auto border-r border-border', listWidth)}>{list}</div>
        <div className="min-w-0 flex-1 overflow-y-auto bg-surface">
          {detail ?? <div className="grid h-full place-items-center p-8 text-center text-[13.5px] text-faint">{empty ?? 'Select an item to see details'}</div>}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="h-full overflow-y-auto">{list}</div>
      <Sheet open={!!detail} onOpenChange={(v) => !v && onCloseDetail()} title={detailTitle ?? 'Details'} width="w-[min(100vw,640px)]">
        {detail}
      </Sheet>
    </>
  );
}

export function DetailPane({
  title,
  subtitle,
  actions,
  children,
  onClose,
  meta,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  meta?: ReactNode;
}) {
  return (
    <article className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 px-5 py-3.5 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold leading-snug">{title}</h2>
            {subtitle && <div className="mt-0.5 text-[12.5px] text-muted">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
          {onClose && (
            <IconButton label="Close" size="sm" onClick={onClose} className="hidden xl:inline-flex">
              <X className="size-4" />
            </IconButton>
          )}
        </div>
        {meta && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-muted">{meta}</div>}
      </header>
      <div className="flex-1 space-y-5 px-5 py-4">{children}</div>
    </article>
  );
}

export function MetaItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-faint">{label}</span>
      <span className="text-fg">{children}</span>
    </span>
  );
}

export interface SmartGroup<T> {
  id: string;
  title: ReactNode;
  items: T[];
  collapsed?: boolean;
  tone?: 'danger' | 'warning' | 'default';
}

/** Spark-style smart grouping (Today / This week / Later / Done …). Empty groups are hidden. */
export function SmartGroupList<T>({
  groups,
  render,
  keyOf,
  empty,
}: {
  groups: SmartGroup<T>[];
  render: (item: T) => ReactNode;
  keyOf: (item: T) => string | number;
  empty?: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => Object.fromEntries(groups.map((g) => [g.id, !!g.collapsed])));
  const visible = groups.filter((g) => g.items.length);
  if (!visible.length) return <>{empty}</>;
  return (
    <div className="pb-6">
      {visible.map((g) => {
        const isCollapsed = collapsed[g.id] ?? !!g.collapsed;
        return (
          <section key={g.id}>
            <button
              type="button"
              onClick={() => setCollapsed({ ...collapsed, [g.id]: !isCollapsed })}
              aria-expanded={!isCollapsed}
              className={cn(
                'sticky top-0 z-[1] flex w-full items-center gap-1.5 border-b border-border bg-bg/95 px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wider backdrop-blur',
                g.tone === 'danger' ? 'text-danger' : g.tone === 'warning' ? 'text-warning' : 'text-faint',
              )}
            >
              {isCollapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
              {g.title}
              <span className="tabular font-medium">{g.items.length}</span>
            </button>
            {!isCollapsed && (
              <ul className="divide-y divide-border">
                {g.items.map((it) => (
                  <li key={keyOf(it)}>{render(it)}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** A selectable row in a list pane. */
export function ListRow({
  selected,
  onClick,
  children,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={selected ? 'true' : undefined}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
        selected ? 'bg-accent-soft' : 'bg-surface hover:bg-bg-subtle',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function StatusPill({ label, tone = 'neutral', className }: { label: ReactNode; tone?: keyof typeof STATUS_TONES; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', STATUS_TONES[tone], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 sm:px-6', className)}>{children}</div>;
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-2', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          {title && <h3 className="text-[12px] font-semibold uppercase tracking-wider text-faint">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Minimal sortable data table used for reports (attendance %, paperwork matrix …). */
export function DataTable<T>({
  rows,
  columns,
  keyOf,
  empty,
  className,
}: {
  rows: T[];
  columns: { id: string; header: ReactNode; cell: (r: T) => ReactNode; sort?: (r: T) => number | string; className?: string; align?: 'right' | 'center' }[];
  keyOf: (r: T) => string | number;
  empty?: ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null);
  const col = sort && columns.find((c) => c.id === sort.id);
  const sorted = col?.sort
    ? [...rows].sort((a, b) => {
        const x = col.sort!(a);
        const y = col.sort!(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort!.dir;
      })
    : rows;
  if (!rows.length && empty) return <>{empty}</>;
  return (
    <div className={cn('overflow-x-auto rounded-lg border border-border bg-surface', className)}>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border bg-bg-subtle/60 text-left">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn('px-3 py-2 font-medium text-muted whitespace-nowrap', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                {c.sort ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 hover:text-fg"
                    onClick={() => setSort(sort?.id === c.id ? { id: c.id, dir: (sort.dir * -1) as 1 | -1 } : { id: c.id, dir: 1 })}
                  >
                    {c.header}
                    {sort?.id === c.id && (sort.dir === 1 ? '↑' : '↓')}
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={keyOf(r)} className="hover:bg-bg-subtle/50">
              {columns.map((c) => (
                <td key={c.id} className={cn('px-3 py-2 align-middle', c.align === 'right' && 'text-right tabular', c.align === 'center' && 'text-center', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
