import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from '@teamhub/ui';
import { getSupabase, moduleSettings, runtime } from './runtime';
import { getRealtime } from './client';
import { useSession } from './session';
import type { Membership, PersonInfo, PositionHolder, PositionRow, Profile } from './types';

export function useSupabase() {
  return getSupabase();
}

export function useConfig() {
  return runtime().config;
}

export function useTeams() {
  return runtime().config.teams;
}

export function teamById(id: string | null | undefined) {
  return id ? runtime().config.teams.find((t) => t.id === id) ?? null : null;
}

export function isMultiTeam(): boolean {
  return runtime().config.program.multiTeam && runtime().config.teams.length > 1;
}

// ── Team scope (sidebar switcher) ─────────────────────────────────────────
const SCOPE_KEY = 'teamhub-team-scope';
const scopeListeners = new Set<() => void>();
function readScope(): string | null {
  if (!isMultiTeam()) return null;
  try {
    const v = localStorage.getItem(SCOPE_KEY);
    return v && runtime().config.teams.some((t) => t.id === v) ? v : null;
  } catch {
    return null;
  }
}
export function setTeamScope(id: string | null) {
  try {
    if (id) localStorage.setItem(SCOPE_KEY, id);
    else localStorage.removeItem(SCOPE_KEY);
  } catch {}
  scopeListeners.forEach((l) => l());
}

/** The team selected in the sidebar switcher; null = "All teams" (or single-team programs). */
export function useTeamScope(): string | null {
  return useSyncExternalStore(
    (l) => {
      scopeListeners.add(l);
      return () => scopeListeners.delete(l);
    },
    readScope,
    () => null,
  );
}

/** Applies the team scope to a PostgREST query: program-wide rows + the selected team's rows. */
export function scoped<Q extends { or: (f: string) => Q }>(q: Q, teamId: string | null): Q {
  return teamId ? q.or(`team_id.is.null,team_id.eq.${teamId}`) : q;
}

// ── Season ─────────────────────────────────────────────────────────────────
export function useSettingsRow() {
  const sb = useSupabase();
  const { me } = useSession();
  return useQuery({
    queryKey: ['core', 'settings'],
    enabled: !!me?.isActive,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb.from('teamhub_settings').select('*').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data as {
        season_label: string;
        last_keepalive: string | null;
        storage_limits: { db_mb: number; files_mb: number };
        storage_history: { month: string; db: number; files: number }[];
        extra_profile_fields: { id: string; label: string; type: 'text' | 'select'; options?: string[] }[];
      } | null;
    },
  });
}

export function useSeason(): string {
  const s = useSettingsRow();
  return s.data?.season_label ?? runtime().config.season;
}

// ── People ─────────────────────────────────────────────────────────────────
export function usePositions() {
  const sb = useSupabase();
  const { me } = useSession();
  return useQuery({
    queryKey: ['core', 'positions'],
    enabled: !!me?.isActive,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb.from('positions').select('*').order('name');
      if (error) throw error;
      return data as PositionRow[];
    },
  });
}

/** Directory of everyone visible to the viewer, with memberships, positions and signed avatar URLs. Cached. */
export function usePeople() {
  const sb = useSupabase();
  const { me } = useSession();
  return useQuery({
    queryKey: ['core', 'people'],
    enabled: !!me?.isActive,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Map<string, PersonInfo>> => {
      const [p, m, h, pos] = await Promise.all([
        sb.from('profiles').select('id, display_name, avatar_path, is_admin, status, details').order('display_name'),
        sb.from('memberships').select('*'),
        sb.from('position_holders').select('*'),
        sb.from('positions').select('id, name'),
      ]);
      for (const r of [p, m, h, pos]) if (r.error) throw r.error;
      const names = new Map((pos.data ?? []).map((x: any) => [x.id, x.name as string]));
      const paths = (p.data ?? []).map((x: any) => x.avatar_path).filter(Boolean) as string[];
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data } = await sb.storage.from('avatars').createSignedUrls(paths, 60 * 60 * 6);
        for (const d of data ?? []) if (d.signedUrl && d.path) urls.set(d.path, d.signedUrl);
      }
      const out = new Map<string, PersonInfo>();
      for (const x of (p.data ?? []) as Profile[]) {
        const holders = ((h.data ?? []) as PositionHolder[]).filter((y) => y.user_id === x.id);
        out.set(x.id, {
          id: x.id,
          name: x.display_name,
          avatarPath: x.avatar_path,
          avatarUrl: x.avatar_path ? urls.get(x.avatar_path) ?? null : null,
          isAdmin: x.is_admin,
          status: x.status,
          details: x.details ?? {},
          memberships: ((m.data ?? []) as Membership[]).filter((y) => y.user_id === x.id),
          positionIds: holders.map((y) => y.position_id),
          positions: holders.map((y) => names.get(y.position_id) ?? y.position_id),
        });
      }
      return out;
    },
  });
}

export function usePerson(id: string | null | undefined): PersonInfo | null {
  const people = usePeople();
  return id ? people.data?.get(id) ?? null : null;
}

/** Active people, optionally limited to a team (null = everyone). */
export function useActivePeople(teamId?: string | null): PersonInfo[] {
  const people = usePeople();
  return useMemo(
    () =>
      [...(people.data?.values() ?? [])].filter(
        (p) => p.status === 'active' && p.memberships.some((m) => m.status === 'active' && (teamId == null || m.team_id === teamId)),
      ),
    [people.data, teamId],
  );
}

/** Holders of a position (routing: e.g. "3D Print Farm Manager"). */
export function usePositionHolders(positionIds: string[]): PersonInfo[] {
  const people = usePeople();
  return useMemo(() => [...(people.data?.values() ?? [])].filter((p) => p.status === 'active' && p.positionIds.some((x) => positionIds.includes(x))), [people.data, positionIds]);
}

export function useSubteams() {
  return runtime().config.subteams;
}

export function useModuleSettings<T = Record<string, unknown>>(id: string): T {
  return moduleSettings<T>(id);
}

// ── Links ─────────────────────────────────────────────────────────────────
export interface LinkRow {
  id: string;
  label: string;
  url: string;
  description: string | null;
  slot: string | null;
  section: string | null;
  team_id: string | null;
  sort: number;
  created_by: string | null;
}

export function useLinks() {
  const sb = useSupabase();
  const { me } = useSession();
  return useQuery({
    queryKey: ['core', 'links'],
    enabled: !!me?.isActive,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb.from('links').select('*').order('sort').order('label');
      if (error) throw error;
      return data as LinkRow[];
    },
  });
}

export function useToolLink(slot: string): LinkRow | null {
  const links = useLinks();
  return links.data?.find((l) => l.slot === slot) ?? null;
}

// ── Errors & mutations ────────────────────────────────────────────────────
export function friendlyError(e: unknown): string {
  const err = e as { code?: string; message?: string; status?: number };
  const msg = err?.message ?? String(e);
  if (err?.code === '42501' || /row-level security/i.test(msg)) return "You don't have permission to do that.";
  if (err?.code === '23505') return 'That already exists.';
  if (err?.code === '23514') return 'Some values are not allowed (check lengths and formats).';
  if (err?.code === 'PGRST116') return 'Not found.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return "Can't reach the server. Check your connection.";
  if (/relation .* does not exist|Could not find the table/i.test(msg)) return 'This tab needs a database update. Ask an admin to run the setup wizard > Update.';
  return msg;
}

/** Throws Supabase errors so TanStack Query sees them. */
export function unwrap<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data;
}

/**
 * Mutation helper: runs fn, shows a toast on error (and optional success), invalidates query keys.
 * Usage: const save = useAction((v) => sb.from('x').insert(v).then(unwrap), { invalidate: [['tasks']] });
 */
export function useAction<V = void, R = unknown>(
  fn: (vars: V) => Promise<R>,
  opts: { invalidate?: QueryKey[]; success?: string | ((r: R) => string); onSuccess?: (r: R, v: V) => void } = {},
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      for (const k of opts.invalidate ?? []) qc.invalidateQueries({ queryKey: k });
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
}

/** Realtime subscription for one table (used sparingly: notifications, check-in, competition day, checklists). */
export function useRealtime(table: string, filter: string | null, onChange: () => void, enabled = true) {
  const sb = useSupabase();
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    if (!enabled) return;
    let ch: { unsubscribe: () => unknown } | null = null;
    let cancelled = false;
    getRealtime(sb).then((rt) => {
      if (cancelled) return;
      ch = rt
        .channel(`rt:${table}:${filter ?? 'all'}:${Math.random().toString(36).slice(2, 7)}`)
        .on('postgres_changes' as any, { event: '*', schema: 'public', table, ...(filter ? { filter } : {}) }, () => cb.current())
        .subscribe();
    });
    return () => {
      cancelled = true;
      ch?.unsubscribe();
    };
  }, [sb, table, filter, enabled]);
}

/** True while the browser tab is visible (pause polling when hidden: be a good FTCScout citizen). */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (l) => {
      document.addEventListener('visibilitychange', l);
      return () => document.removeEventListener('visibilitychange', l);
    },
    () => document.visibilityState === 'visible',
    () => true,
  );
}

// ── Files ─────────────────────────────────────────────────────────────────
export function useSignedUrls(bucket: string, paths: (string | null | undefined)[]) {
  const sb = useSupabase();
  const list = paths.filter(Boolean) as string[];
  return useQuery({
    queryKey: ['core', 'signed', bucket, list],
    enabled: list.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await sb.storage.from(bucket).createSignedUrls(list, 60 * 60);
      if (error) throw error;
      return new Map<string, string>((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]));
    },
  });
}

/** Files storage usage vs. limit: FileDrop refuses uploads at ≥ 98 % (spec §11.4). */
export function useStorageFull(): boolean {
  const sb = useSupabase();
  const { me } = useSession();
  const q = useQuery({
    queryKey: ['core', 'storage-full'],
    enabled: !!me?.isActive,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data } = await sb.rpc('teamhub_files_nearly_full');
      return !!data;
    },
  });
  return q.data ?? false;
}

export function useLocalStorage<T>(key: string, initial: T): [T, (v: T) => void] {
  const read = () => {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : initial;
    } catch {
      return initial;
    }
  };
  const subscribe = (l: () => void) => {
    window.addEventListener(`ls:${key}`, l);
    return () => window.removeEventListener(`ls:${key}`, l);
  };
  const raw = useSyncExternalStore(subscribe, () => localStorage.getItem(key) ?? '', () => '');
   
  const value = useMemo(read, [raw]);
  const set = (v: T) => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
    window.dispatchEvent(new Event(`ls:${key}`));
  };
  return [value, set];
}

/**
 * Query helper for module lists: `useRows<Task>(['tasks', 'list'], (sb) => sb.from('task_items').select('*'))`.
 * Throws Supabase errors so the UI can show an ErrorState.
 */
export function useRows<T>(key: QueryKey, fn: (sb: ReturnType<typeof getSupabase>) => PromiseLike<{ data: unknown; error: unknown }>, opts: { enabled?: boolean; staleTime?: number; refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: key,
    queryFn: async () => unwrap(await fn(getSupabase())) as T[],
    ...opts,
  });
}

/** Per-device "last seen" timestamp (unread state without database rows, spec §13.4). */
export function useLastSeen(key: string): [number, () => void] {
  const [v, set] = useLocalStorage<number>(`teamhub-seen:${key}`, 0);
  return [v, () => set(Date.now())];
}
