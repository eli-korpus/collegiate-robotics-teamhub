import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultSeasonLabel, type TeamhubConfig } from '@teamhub/config-schema';
import { useConfirm } from '@teamhub/ui';
import { api, type Catalog, type Draft, type ServerState } from './api';

/** Students only: mentors aren't asked for their grade, subteam, shirt size or an emergency contact. */
const STUDENTS: ('member' | 'captain' | 'mentor')[] = ['member', 'captain'];
export const SUGGESTED_FIELDS = [
  { id: 'grade', label: 'Grade', type: 'select' as const, options: ['9', '10', '11', '12'], private: false, askTypes: STUDENTS },
  { id: 'subteam', label: 'Subteam', type: 'multiselect' as const, options: [] as string[], private: false, askTypes: STUDENTS },
  { id: 'shirt_size', label: 'Shirt size', type: 'select' as const, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], private: false, visibility: 'leaders' as const, askTypes: STUDENTS },
  { id: 'dietary', label: 'Dietary needs', type: 'text' as const, options: [], private: false, visibility: 'leaders' as const },
  { id: 'emergency_contact', label: 'Emergency contact', type: 'text' as const, options: [], private: true, visibility: 'mentors' as const, askTypes: STUDENTS },
];

/** Per-team options only make sense with several teams: "several teams" chosen and at least two added. */
export const hasSeveralTeams = (c: TeamhubConfig) => c.program.multiTeam && c.teams.length > 1;

/** After teams are removed: drop links and settings that point at a team that no longer exists. */
export function dropMissingTeamRefs(x: TeamhubConfig) {
  const ids = new Set(x.teams.map((t) => t.id));
  x.toolLinks = x.toolLinks.filter((l) => !l.teamId || ids.has(l.teamId));
  for (const p of x.positions) if (p.teamId && !ids.has(p.teamId)) p.teamId = null;
  if (x.teams.length < 2) {
    // One team: a "separate link per team" is just the link.
    const seen = new Set<string>();
    x.toolLinks = x.toolLinks.filter((l) => {
      if (!l.slot || !l.teamId) return true;
      if (seen.has(l.slot) || x.toolLinks.some((o) => o.slot === l.slot && !o.teamId)) return false;
      seen.add(l.slot);
      return true;
    });
    for (const l of x.toolLinks) l.teamId = null;
  }
}

export function newConfig(): TeamhubConfig {
  return {
    configVersion: 1,
    program: { name: '', logo: null, multiTeam: false },
    teams: [{ id: crypto.randomUUID(), number: null, name: '', shortCode: 'A', color: '#2563EB', logo: null, logoDark: null, school: null, city: null }],
    theme: { accent: '#2563EB', secondary: null, corners: 'soft', defaultMode: 'system' },
    season: defaultSeasonLabel(),
    modules: {},
    subteams: [
      { id: 'build', name: 'Build' },
      { id: 'programming', name: 'Programming' },
      { id: 'cad', name: 'CAD' },
      { id: 'outreach', name: 'Outreach' },
    ],
    positions: [],
    profileFields: [],
    permissions: {},
    home: { defaults: { member: [], captain: [], mentor: [] } },
    nav: { order: [] },
    toolLinks: [],
    join: { allowedEmailDomains: [] },
    hosting: { provider: null, url: null, basePath: '/' },
    supabase: { url: null, anonKey: null, projectRef: null },
    features: { email: false },
  };
}

export function newDraft(flow: 'setup' | 'edit', config?: TeamhubConfig | null): Draft {
  return { version: 1, flow, step: 0, config: structuredClone(config ?? newConfig()), done: {}, removals: {} };
}

interface Ctx {
  draft: Draft;
  catalog: Catalog;
  server: ServerState;
  refreshServer: () => Promise<void>;
  setDraft: (fn: (d: Draft) => Draft) => void;
  update: (fn: (c: TeamhubConfig) => void) => void;
  go: (step: number) => void;
  reset: (d: Draft | null) => void;
}

const DraftCtx = createContext<Ctx | null>(null);

export function DraftProvider({ initial, catalog, server: initialServer, children, onExit }: { initial: Draft; catalog: Catalog; server: ServerState; children: ReactNode; onExit: (d: Draft | null) => void }) {
  const [draft, setDraftState] = useState(initial);
  const [server, setServer] = useState(initialServer);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api('/draft', draft, 'PUT').catch(() => {});
    }, 500);
  }, [draft]);
  // Leaving (Back to wizard home, Finish) deletes the draft: a save still waiting must not bring it back.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const setDraft = useCallback((fn: (d: Draft) => Draft) => setDraftState((d) => fn(d)), []);
  const update = useCallback(
    (fn: (c: TeamhubConfig) => void) =>
      setDraftState((d) => {
        const c = structuredClone(d.config);
        fn(c);
        return { ...d, config: c };
      }),
    [],
  );
  const value: Ctx = {
    draft,
    catalog,
    server,
    refreshServer: async () => setServer(await api<ServerState>('/state')),
    setDraft,
    update,
    go: (step) => {
      setDraftState((d) => ({ ...d, step }));
      document.getElementById('wizard-main')?.scrollTo({ top: 0 });
    },
    reset: onExit,
  };
  return <DraftCtx.Provider value={value}>{children}</DraftCtx.Provider>;
}

export function useDraft(): Ctx {
  const c = useContext(DraftCtx);
  if (!c) throw new Error('useDraft outside provider');
  return c;
}

/**
 * Whether an edit has anything not applied yet: the same change list Review & apply shows, plus a replaced logo.
 * When it can't tell (the wizard server didn't answer), it says yes, so nothing is thrown away without asking.
 */
export async function editHasChanges(config: TeamhubConfig): Promise<boolean> {
  try {
    const [diff, state] = await Promise.all([api<{ lines: unknown[] }>('/diff', config), api<ServerState>('/state')]);
    return diff.lines.length > 0 || !!state.brandingPending;
  } catch {
    return true;
  }
}

/** Settings an edit doesn't change, taken from the saved config (they may have changed on wizard home since). */
export function rebaseEdit(d: Draft, saved: TeamhubConfig): Draft {
  return { ...d, config: { ...d.config, supabase: saved.supabase, hosting: saved.hosting, features: saved.features, season: saved.season } };
}

/** "Back to wizard home" from an edit: asks before discarding only when there's something to lose. */
export function useLeaveEdit() {
  const { draft, reset } = useDraft();
  const confirm = useConfirm();
  return async () => {
    if (await editHasChanges(draft.config)) {
      const ok = await confirm({
        title: 'Discard these edits?',
        body: 'They haven’t been applied to your database or website. Logos you uploaded in this edit are put back too.',
        danger: true,
        confirmLabel: 'Discard',
      });
      if (!ok) return;
    }
    await api('/draft', undefined, 'DELETE');
    reset(null);
  };
}
