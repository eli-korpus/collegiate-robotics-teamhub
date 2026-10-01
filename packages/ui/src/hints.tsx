import type { ReactNode } from 'react';
import { Eye, Lock, Info, ArrowRight, Plus, ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { Button } from './primitives';
import { Menu, type MenuItem } from './overlays';

/**
 * "Who will see this?" — rendered next to every composer, field group, upload and response UI (spec P6, §10.8).
 */
export function VisibilityNote({ children, locked, className }: { children: ReactNode; locked?: boolean; className?: string }) {
  return (
    <p className={cn('flex items-center gap-1.5 text-[12px]', locked ? 'text-warning' : 'text-muted', className)}>
      {locked ? <Lock className="size-3.5 shrink-0" aria-label="Private" /> : <Eye className="size-3.5 shrink-0" aria-hidden />}
      <span>{children}</span>
    </p>
  );
}

export interface PurposeLink {
  text: string;
  /** Resolved destination; null when the target tab/tool isn't available (rendered as plain text). */
  href: string | null;
  label?: string;
  external?: boolean;
}

/** A tab's one-line purpose and its "not for" list with links to the right place (spec P6). */
export function PurposeHint({ purpose, notFor, className, compact }: { purpose: string; notFor: PurposeLink[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-md border border-border bg-bg-subtle/60 px-3 py-2.5 text-[12.5px]', className)}>
      <p className="flex items-start gap-1.5 text-fg">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted" />
        <span>{purpose}</span>
      </p>
      {!!notFor.length && (
        <ul className={cn('mt-1.5 text-muted', compact ? 'flex flex-wrap gap-x-3 gap-y-0.5 pl-5' : 'space-y-0.5 pl-5')}>
          {notFor.map((n, i) => (
            <li key={i}>
              Not for {n.text.charAt(0).toLowerCase() + n.text.slice(1)}
              {n.href && (
                <>
                  {' '}
                  →{' '}
                  <a href={n.href} target={n.external ? '_blank' : undefined} rel={n.external ? 'noreferrer' : undefined} className="font-medium text-accent hover:underline">
                    {n.label ?? 'go there'}
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "New …" button; when other tabs offer typed shortcuts it becomes a split menu (spec P6). */
export function NewMenu({ label, onNew, shortcuts }: { label: string; onNew: () => void; shortcuts: MenuItem[] }) {
  if (!shortcuts.length) {
    return (
      <Button variant="primary" icon={<Plus className="size-4" />} onClick={onNew}>
        {label}
      </Button>
    );
  }
  return (
    <div className="inline-flex">
      <Button variant="primary" icon={<Plus className="size-4" />} onClick={onNew} className="rounded-r-none">
        {label}
      </Button>
      <Menu
        label="Something else?"
        trigger={
          <Button variant="primary" aria-label="More create options" className="rounded-l-none border-l border-white/20 px-2">
            <ChevronDown className="size-4" />
          </Button>
        }
        items={shortcuts.map((s) => ({ ...s, icon: s.icon ?? <ArrowRight /> }))}
      />
    </div>
  );
}
