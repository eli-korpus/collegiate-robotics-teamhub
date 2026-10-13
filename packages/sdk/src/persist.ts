import { dehydrate, hydrate, type Query, type QueryClient } from '@tanstack/react-query';

/**
 * Remembers loaded data between visits, so Home and the sidebar show right away and refresh in the background.
 *
 * Safety: saved only for the signed-in person and thrown away when someone else signs in, on sign-out, after a day,
 * and whenever a new version of the site is deployed (data shapes may change). The database still decides what
 * anyone can load; this only keeps a copy of what this browser already loaded. A query can opt out with
 * `meta: { persist: false }`. Anything that isn't plain data (icons, components, functions) is never saved.
 */
const KEY = 'teamhub-cache';
const MAX_AGE = 24 * 60 * 60_000;
const MAX_CHARS = 2_500_000; // stays well inside the browser's ~5 MB localStorage limit

declare const __TEAMHUB_BUILD__: string | undefined;
function buildId(): string {
  return typeof __TEAMHUB_BUILD__ === 'string' ? __TEAMHUB_BUILD__ : 'dev';
}

interface Saved {
  build: string;
  userId: string;
  savedAt: number;
  state: unknown;
}

// JSON can't hold Map, Set or Date: tag them so they come back as the same types.
function replacer(this: Record<string, unknown>, key: string, value: unknown) {
  const raw = this[key];
  if (raw instanceof Date) return { __thDate: raw.getTime() };
  if (value instanceof Map) return { __thMap: [...value] };
  if (value instanceof Set) return { __thSet: [...value] };
  return value;
}
function reviver(_key: string, value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const v = value as Record<string, unknown>;
    if ('__thDate' in v) return new Date(v.__thDate as number);
    if ('__thMap' in v) return new Map(v.__thMap as [unknown, unknown][]);
    if ('__thSet' in v) return new Set(v.__thSet as unknown[]);
  }
  return value;
}

/** True when the value survives a save and restore unchanged (no React elements, functions or class instances). */
export function isPlainData(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (value === null || value === undefined) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (t !== 'object') return false;
  if (value instanceof Date) return true;
  if (Array.isArray(value)) return value.every((v) => isPlainData(v, depth + 1));
  if (value instanceof Map) return [...value].every(([k, v]) => isPlainData(k, depth + 1) && isPlainData(v, depth + 1));
  if (value instanceof Set) return [...value].every((v) => isPlainData(v, depth + 1));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  if ('$$typeof' in (value as object)) return false;
  return Object.values(value as object).every((v) => isPlainData(v, depth + 1));
}

function shouldSave(q: Query): boolean {
  return q.state.status === 'success' && q.meta?.persist !== false && isPlainData(q.state.data);
}

export function serializeCache(qc: QueryClient, userId: string, now = Date.now()): string {
  const saved: Saved = { build: buildId(), userId, savedAt: now, state: dehydrate(qc, { shouldDehydrateQuery: shouldSave }) };
  return JSON.stringify(saved, replacer);
}

/** Puts back what this person loaded last time. Returns false (and forgets it) when it doesn't apply. */
export function restoreSerializedCache(qc: QueryClient, raw: string, userId: string, now = Date.now()): boolean {
  const saved = JSON.parse(raw, reviver) as Saved;
  if (saved.build !== buildId() || saved.userId !== userId || now - saved.savedAt > MAX_AGE) return false;
  hydrate(qc, saved.state as Parameters<typeof hydrate>[1]);
  // Shown at once but always refreshed when used, so changes (a new role, a new task) appear right after.
  void qc.invalidateQueries({ refetchType: 'none' });
  return true;
}

export function restoreQueryCache(qc: QueryClient, userId: string): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && !restoreSerializedCache(qc, raw, userId)) localStorage.removeItem(KEY);
  } catch {
    clearPersistedCache();
  }
}

/** Saves the cache a second after data loads (and when the page is hidden). Returns a stop function. */
export function startPersisting(qc: QueryClient, userId: string): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    clearTimeout(timer);
    timer = undefined;
    try {
      const raw = serializeCache(qc, userId);
      if (raw.length > MAX_CHARS) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, raw);
    } catch {
      clearPersistedCache();
    }
  };
  const unsub = qc.getQueryCache().subscribe((e) => {
    if (e.type === 'updated' && e.action.type === 'success' && !timer) timer = setTimeout(save, 1000);
  });
  const onHide = () => timer && save();
  window.addEventListener('pagehide', onHide);
  return () => {
    unsub();
    clearTimeout(timer);
    window.removeEventListener('pagehide', onHide);
  };
}

export function clearPersistedCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
