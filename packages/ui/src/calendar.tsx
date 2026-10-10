import { useMemo, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';
import { Button, IconButton, Segmented } from './primitives';
import { addDays, formatDate, formatTime, sameDay, startOfDay } from './time';

export interface CalendarItem {
  id: string;
  title: string;
  start: Date;
  end?: Date | null;
  allDay?: boolean;
  color?: string;
  icon?: ReactNode;
  /** small secondary text (location, team) */
  meta?: string;
  /** item comes from another tab (overlay) */
  overlay?: boolean;
  cancelled?: boolean;
}

export type CalendarView = 'month' | 'week' | 'agenda';

export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

export function calendarRange(view: CalendarView, cursor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const from = startOfWeek(first);
    return { from, to: addDays(from, 42) };
  }
  if (view === 'week') {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const from = startOfDay(cursor);
  return { from, to: addDays(from, 60) };
}

/** Month / Week / Agenda calendar (spec §9.4). Presentational: data comes from the caller. */
export function Calendar({
  view,
  onViewChange,
  cursor,
  onCursorChange,
  items,
  onItemClick,
  onDayClick,
  toolbarExtra,
}: {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  cursor: Date;
  onCursorChange: (d: Date) => void;
  items: CalendarItem[];
  onItemClick?: (item: CalendarItem) => void;
  onDayClick?: (d: Date) => void;
  toolbarExtra?: ReactNode;
}) {
  const { from, to } = calendarRange(view, cursor);
  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      // multi-day items appear on every day they span
      const last = it.end && !sameDay(it.start, it.end) ? startOfDay(new Date(it.end.getTime() - 1)) : startOfDay(it.start);
      for (let d = startOfDay(it.start); d <= last && d < to; d = addDays(d, 1)) {
        if (d < from) continue;
        const k = d.toDateString();
        m.set(k, [...(m.get(k) ?? []), it]);
      }
    }
    for (const list of m.values()) list.sort((a, b) => Number(!a.allDay) - Number(!b.allDay) || a.start.getTime() - b.start.getTime());
    return m;
  }, [items, from, to]);

  const step = (dir: 1 | -1) => {
    const d = new Date(cursor);
    if (view === 'month') d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * (view === 'week' ? 7 : 30));
    onCursorChange(d);
  };
  const title =
    view === 'month'
      ? formatDate(cursor, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${formatDate(from)} – ${formatDate(addDays(from, 6), { month: 'short', day: 'numeric', year: 'numeric' })}`
        : `From ${formatDate(cursor, { month: 'long', day: 'numeric' })}`;
  const today = new Date();

  const chip = (it: CalendarItem, compact = true) => (
    <button
      key={it.id + it.start.toISOString()}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onItemClick?.(it);
      }}
      className={cn(
        'flex w-full min-w-0 items-center gap-1 rounded-[5px] px-1.5 text-left transition-colors hover:brightness-95',
        compact ? 'h-5 text-[11.5px]' : 'py-1 text-[12.5px]',
        it.cancelled && 'line-through opacity-60',
      )}
      style={{ background: `color-mix(in oklab, ${it.color ?? 'var(--accent)'} 16%, transparent)`, color: 'var(--text)' }}
      title={`${it.title}${it.allDay ? '' : ` · ${formatTime(it.start)}`}${it.meta ? ` · ${it.meta}` : ''}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: it.color ?? 'var(--accent)', outline: it.overlay ? '1px dashed currentColor' : undefined }} />
      {!it.allDay && <span className="tabular shrink-0 text-muted max-sm:hidden">{formatTime(it.start).replace(':00', '')}</span>}
      <span className="truncate font-medium">{it.title}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1">
          <IconButton label="Previous" size="sm" onClick={() => step(-1)}>
            <ChevronLeft className="size-4" />
          </IconButton>
          <IconButton label="Next" size="sm" onClick={() => step(1)}>
            <ChevronRight className="size-4" />
          </IconButton>
          <Button size="sm" variant="ghost" onClick={() => onCursorChange(new Date())}>
            Today
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold max-sm:min-w-[min(100%,9rem)]">{title}</h2>
        {toolbarExtra}
        <Segmented
          size="sm"
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'agenda', label: 'Agenda' },
          ]}
        />
      </div>

      {view === 'agenda' ? (
        <div className="flex-1 relative overflow-y-auto">
          {[...byDay.entries()]
            .map(([k, list]) => [new Date(k), list] as const)
            .sort((a, b) => a[0].getTime() - b[0].getTime())
            .map(([day, list]) => (
              <section key={day.toDateString()} className="border-b border-border">
                <h3 className={cn('sticky top-0 bg-bg/95 px-4 py-1.5 text-[12px] font-semibold backdrop-blur sm:px-6', sameDay(day, today) ? 'text-accent' : 'text-muted')}>
                  {formatDate(day, { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <ul className="divide-y divide-border bg-surface">
                  {list.map((it) => (
                    <li key={it.id + it.start.toISOString()}>
                      <button type="button" onClick={() => onItemClick?.(it)} className={cn('flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-subtle sm:px-6', it.cancelled && 'opacity-60')}>
                        <span className="tabular w-16 shrink-0 text-[12.5px] text-muted">{it.allDay ? 'All day' : formatTime(it.start)}</span>
                        <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: it.color ?? 'var(--accent)' }} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13.5px] font-medium', it.cancelled && 'line-through')}>{it.title}</span>
                          {it.meta && <span className="block truncate text-[12px] text-muted">{it.meta}</span>}
                        </span>
                        {it.icon && <span className="[&>svg]:size-4">{it.icon}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {!byDay.size && <p className="p-10 text-center text-[13.5px] text-faint">Nothing scheduled in the next 60 days.</p>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col relative overflow-auto">
          <div className="grid grid-cols-7 border-b border-border bg-surface text-center text-[11.5px] font-medium text-faint">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="py-1.5">
                {formatDate(addDays(from, i), { weekday: 'short' })}
                {view === 'week' && <span className={cn('ml-1', sameDay(addDays(from, i), today) && 'text-accent font-semibold')}>{addDays(from, i).getDate()}</span>}
              </div>
            ))}
          </div>
          <div className={cn('grid flex-1 grid-cols-7', view === 'month' ? 'auto-rows-[minmax(92px,1fr)]' : 'auto-rows-[minmax(420px,1fr)]')}>
            {Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => {
              const day = addDays(from, i);
              const list = byDay.get(day.toDateString()) ?? [];
              const outside = view === 'month' && day.getMonth() !== cursor.getMonth();
              const max = view === 'month' ? 3 : 30;
              return (
                <div
                  key={i}
                  onClick={() => onDayClick?.(day)}
                  className={cn('min-w-0 space-y-0.5 border-b border-r border-border p-1', outside ? 'bg-bg-subtle/50' : 'bg-surface', onDayClick && 'cursor-pointer')}
                >
                  {view === 'month' && (
                    <div className={cn('mb-0.5 flex justify-end text-[11.5px]', outside ? 'text-faint' : 'text-muted')}>
                      <span className={cn('tabular grid size-5 place-items-center rounded-full', sameDay(day, today) && 'bg-accent font-semibold text-accent-fg')}>{day.getDate()}</span>
                    </div>
                  )}
                  {list.slice(0, max).map((it) => chip(it, view === 'month'))}
                  {list.length > max && <p className="px-1 text-[11px] text-muted">+{list.length - max} more</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
