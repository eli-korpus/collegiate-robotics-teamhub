import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultSeasonLabel, type TeamhubConfig } from '@teamhub/config-schema';
import { api, type Catalog, type Draft, type ServerState } from './api';

export const SUGGESTED_FIELDS = [
  { id: 'grade', label: 'Grade', type: 'select' as const, options: ['9', '10', '11', '12'], private: false },
  { id: 'subteam', label: 'Subteam', type: 'select' as const, options: [] as string[], private: false },
  { id: 'shirt_size', label: 'Shirt size', type: 'select' as const, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], private: false },
  { id: 'dietary', label: 'Dietary needs', type: 'text' as const, options: [], private: false },
  { id: 'emergency_contact', label: 'Emergency contact', type: 'text' as const, options: [], private: true },
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
