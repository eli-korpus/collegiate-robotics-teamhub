import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runtime } from './runtime';
import { useSession } from './session';
import { useSupabase } from './hooks';

export type SchemaState = 'ok' | 'behind' | 'missing' | 'unknown';

/** Compares teamhub_modules (DB) to generated schema expectations (spec §5.7). One tiny cached query. */
export function useSchemaStatus() {
  const sb = useSupabase();
  const { me } = useSession();
  const q = useQuery({
    queryKey: ['core', 'schema'],
    enabled: !!me,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb.from('teamhub_modules').select('id, version, state');
      if (error) throw error;
      return new Map((data ?? []).map((r: any) => [r.id as string, r as { version: number; state: string }]));
    },
  });
  const exp = runtime().schema;
  const status = (id: string): SchemaState => {
    if (!q.data) return 'unknown';
    const want = id === 'core' ? exp.core : exp.modules[id] ?? exp.integrations[id];
    const have = q.data.get(id);
    if (want == null) return 'ok';
    if (!have) return 'missing';
    return have.version < want ? 'behind' : 'ok';
  };
  const ids = ['core', ...Object.keys(exp.modules), ...Object.keys(exp.integrations)];
  const problems = q.data ? ids.filter((id) => status(id) !== 'ok') : [];
  return { status, problems, loading: q.isLoading, error: q.error, db: q.data };
}

// ── Keyboard shortcuts (spec §9.1: ⌘K, j/k, c, /, ?) ───────────────────────
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || !!t.closest('[role="dialog"]');
}

/** Single-key shortcut outside of inputs/dialogs. */
export function useShortcut(key: string, handler: (e: KeyboardEvent) => void, enabled = true) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const fn = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
      if (e.key === key) {
        e.preventDefault();
        h.current(e);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [key, enabled]);
}

/** `c` = create in the current tab. */
export function useCreateShortcut(handler: () => void, enabled = true) {
  useShortcut('c', handler, enabled);
}

/** j / k to move through a list; Enter is handled by the focused row. */
export function useListNav<T>(items: T[], selected: T | null | undefined, select: (t: T) => void, keyOf: (t: T) => unknown) {
  const sel = selected == null ? -1 : items.findIndex((i) => keyOf(i) === keyOf(selected));
  useShortcut('j', () => {
    if (items.length) select(items[Math.min(items.length - 1, sel + 1)]);
  });
  useShortcut('k', () => {
    if (items.length) select(items[Math.max(0, sel - 1)]);
  });
}

export const SHORTCUTS: [string, string][] = [
  ['Mod K', 'Open the command bar (search, go to, actions)'],
  ['/', 'Search'],
  ['c', 'Create something new in this tab'],
  ['j / k', 'Next / previous item in a list'],
  ['g h', 'Go home'],
  ['?', 'Show keyboard shortcuts'],
  ['Esc', 'Close a dialog or panel'],
];
