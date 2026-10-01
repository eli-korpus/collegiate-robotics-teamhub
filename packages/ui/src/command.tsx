import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog as RDialog } from 'radix-ui';
import { Search, CornerDownLeft } from 'lucide-react';
import { cn } from './cn';
import { Kbd, Spinner } from './primitives';

export interface CommandItem {
  id: string;
  label: ReactNode;
  /** text used for keyboard filtering when label is not a string */
  keywords?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface CommandSection {
  title: string;
  items: CommandItem[];
}

/** ⌘K palette (spec §10.2). Callers provide already-filtered sections; arrow keys + Enter navigate. */
export function CommandBar({
  open,
  onOpenChange,
  query,
  onQueryChange,
  sections,
  loading,
  placeholder = 'Search or jump to…',
  footer,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  query: string;
  onQueryChange: (q: string) => void;
  sections: CommandSection[];
  loading?: boolean;
  placeholder?: string;
  footer?: ReactNode;
}) {
  const flat = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => setActive(0), [query, sections.length]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const run = (it: CommandItem | undefined) => {
    if (!it) return;
    onOpenChange(false);
    it.onSelect();
  };

  let idx = -1;
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      <RDialog.Portal>
        <RDialog.Overlay className="th-anim-fade fixed inset-0 z-50 bg-black/40" />
        <RDialog.Content
          className="th-anim-pop fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-lg border border-border bg-raised shadow-md"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(flat.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              run(flat[active]);
            }
          }}
        >
          <RDialog.Title className="sr-only">Command bar</RDialog.Title>
          <RDialog.Description className="sr-only">Search, go to a tab or run an action</RDialog.Description>
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="size-4 text-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              role="combobox"
              aria-expanded
              aria-controls="th-cmd-list"
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
            />
            {loading && <Spinner className="[&_svg]:size-4" />}
          </div>
          <div ref={listRef} id="th-cmd-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {sections.map((s) =>
              s.items.length ? (
                <div key={s.title} className="pb-1">
                  <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-faint">{s.title}</p>
                  {s.items.map((it) => {
                    idx++;
                    const i = idx;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        role="option"
                        aria-selected={i === active}
                        data-active={i === active}
                        onMouseMove={() => setActive(i)}
                        onClick={() => run(it)}
                        className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px]', i === active && 'bg-accent-soft')}
                      >
                        {it.icon && <span className={cn('shrink-0 text-muted [&>svg]:size-4', i === active && 'text-accent')}>{it.icon}</span>}
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {it.hint && <span className="shrink-0 truncate text-[12px] text-faint">{it.hint}</span>}
                        {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-faint" />}
                      </button>
                    );
                  })}
                </div>
              ) : null,
            )}
            {!flat.length && !loading && <p className="px-3 py-8 text-center text-[13px] text-faint">No results{query ? ` for “${query}”` : ''}</p>}
          </div>
          <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11.5px] text-faint">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> navigate
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>↵</Kbd> open
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>esc</Kbd> close
            </span>
            <span className="flex-1" />
            {footer}
          </div>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

/** Simple fuzzy-ish match: all query words must appear. */
export function matches(text: string, query: string): boolean {
  const t = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => t.includes(w));
}
