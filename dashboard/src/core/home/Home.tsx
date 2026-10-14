import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { LayoutGrid } from 'lucide-react';
import { Button, formatDate, greeting, useMediaQuery } from '@teamhub/ui';
import { canWith, runtime, useMe, useSeason, useTeamScope, type WidgetDef } from '@teamhub/sdk';
import { ProgramLogo } from '../auth/AuthLayout';
import { CORE_WIDGETS } from './coreWidgets';
import { Masonry } from './Masonry';

const CustomizeDialog = lazy(() => import('./CustomizeDialog'));

export interface HomeWidget extends WidgetDef {
  key: string; // module:id
}

function useAllWidgets(): HomeWidget[] {
  const me = useMe();
  return useMemo(() => {
    const out: HomeWidget[] = CORE_WIDGETS.map((w) => ({ ...w, key: `core:${w.id}` }));
    for (const m of runtime().modules) for (const w of m.client.widgets ?? []) out.push({ ...w, key: `${m.manifest.id}:${w.id}` });
    return out.filter((w) => !w.perm || canWith(me, w.perm));
  }, [me]);
}

/**
 * A tab can replace the normal greeting (e.g. Events: "3 days to the qualifier"). The list of tabs is fixed when the
 * site is built, so these hooks always run in the same order.
 */
function Greeting({ teamId }: { teamId: string | null }) {
  let special: string | null = null;
  for (const m of runtime().modules) special = m.client.useGreeting?.(teamId) ?? special;
  return <>{special ?? greeting()}</>;
}

/** Highest profile type → default widget order set in the wizard (spec §12.1). */
function defaultOrder(me: ReturnType<typeof useMe>): string[] {
  const types = me.memberships.filter((m) => m.status === 'active').map((m) => m.type);
  const t = types.includes('mentor') ? 'mentor' : types.includes('captain') ? 'captain' : 'member';
  return runtime().config.home.defaults[t] ?? [];
}

export function Home() {
  const me = useMe();
  const season = useSeason();
  const teamId = useTeamScope();
  const all = useAllWidgets();
  const [editing, setEditing] = useState(false);
  const prefs = me.profile.home_prefs;
  // The Setup assistant took the place of "Info requested from you" (core:request-info) in saved layouts.
  const renamed = (k: string) => (k === 'core:request-info' ? 'core:profile-setup' : k);
  const order = (prefs?.order?.length ? prefs.order : defaultOrder(me)).map(renamed);
  const hidden = new Set(prefs?.hidden ?? []);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : 1000 + all.findIndex((w) => w.key === k));
  const visible = all.filter((w) => !hidden.has(w.key)).sort((a, b) => rank(a.key) - rank(b.key));
  const today = visible.filter((w) => w.priority === 'today');
  const grid = visible.filter((w) => w.priority !== 'today');
  const first = me.profile.display_name.split(' ')[0];
  const settle = useSettled();
  const wide = useMediaQuery('(min-width: 1024px)');

  return (
    <div className="relative mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <ProgramLogo size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-tight">
            <Greeting teamId={teamId} />, {first}
          </h1>
          <p className="text-[13px] text-muted">
            {formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })} · {runtime().config.program.name} · Season {season}
          </p>
        </div>
        <Button size="sm" variant="ghost" icon={<LayoutGrid className="size-4" />} onClick={() => setEditing(true)}>
          Customize
        </Button>
      </header>

      {settle.showSkeleton && <HomeSkeleton />}
      {/* Cards load out of sight (below the header, see-through and not clickable) and appear together, so they don't jump
          around while each one fetches its data. Opacity, not visibility: Masonry marks each placed card visible. */}
      <PendingContext.Provider value={settle.track}>
        <div data-home-ready={settle.ready || undefined} inert={!settle.ready} className={settle.ready ? 'th-anim-fade' : 'absolute inset-x-4 opacity-0 sm:inset-x-6'}>
          {wide ? (
            // Desktop: every card shares one set of columns (today's cards first), so the gaps are the same everywhere and
            // the columns end at about the same height. The heading hides when no card for today has anything to show.
            <section aria-label="Today" className="[&:not(:has([data-today]:not(:empty)))>h2]:hidden">
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Today &amp; this week</h2>
              <Masonry animate={settle.ready} items={[...today, ...grid].map((w) => ({ key: w.key, node: <WidgetSlot w={w} teamId={teamId} today={w.priority === 'today'} /> }))} />
            </section>
          ) : (
            <>
              {today.length > 0 && (
                // The heading hides too when every card in it has nothing to show today.
                <section aria-label="Today" className="mb-6 [&:not(:has(>div>div:not(:empty)))]:hidden">
                  <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Today &amp; this week</h2>
                  {/* Cards stretch to fill their row, so one card never leaves empty space beside it. */}
                  <div className="flex flex-wrap gap-3 [&>div:empty]:hidden [&>div]:min-w-[min(100%,300px)] [&>div]:flex-1">
                    {today.map((w) => (
                      <WidgetSlot key={w.key} w={w} teamId={teamId} />
                    ))}
                  </div>
                </section>
              )}

              <Masonry animate={settle.ready} items={grid.map((w) => ({ key: w.key, node: <WidgetSlot w={w} teamId={teamId} /> }))} />
            </>
          )}
        </div>
      </PendingContext.Provider>

      {editing && (
        <Suspense fallback={null}>
          <CustomizeDialog open={editing} onOpenChange={setEditing} all={all} order={visible.map((w) => w.key).concat(all.filter((w) => hidden.has(w.key)).map((w) => w.key))} hidden={hidden} />
        </Suspense>
      )}
    </div>
  );
}

function WidgetSlot({ w, teamId, today }: { w: HomeWidget; teamId: string | null; today?: boolean }) {
  const C = w.component;
  return (
    <div data-today={today || undefined}>
      <Suspense fallback={<Pending />}>
        <C teamId={teamId} />
      </Suspense>
    </div>
  );
}


/** Counts Home cards whose code is still downloading (their Suspense fallback is showing). */
const PendingContext = createContext<(delta: number) => void>(() => {});

function Pending() {
  const track = useContext(PendingContext);
  useEffect(() => {
    track(1);
    return () => track(-1);
  }, [track]);
  return null;
}

/**
 * Home is ready once every card's code has arrived and nothing is loading for the first time (a short quiet moment),
 * or after 1.5 s at most so a slow card (e.g. FTCScout) never holds up the rest. Data remembered from the last visit
 * counts as loaded, so a returning visitor sees Home at once.
 */
function useSettled() {
  const [pending, setPending] = useState(0);
  const track = useCallback((d: number) => setPending((p) => p + d), []);
  const firstLoads = useIsFetching({ predicate: (q) => q.state.data === undefined });
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const busy = pending > 0 || firstLoads > 0;
  useEffect(() => {
    const skeleton = setTimeout(() => setSlow(true), 200);
    const cap = setTimeout(() => setReady(true), 1500);
    return () => {
      clearTimeout(skeleton);
      clearTimeout(cap);
    };
  }, []);
  useEffect(() => {
    if (ready || busy) return;
    const t = setTimeout(() => setReady(true), 120);
    return () => clearTimeout(t);
  }, [ready, busy]);
  return { ready, track, showSkeleton: slow && !ready };
}

function HomeSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-lg bg-bg-subtle motion-reduce:animate-none" />
      ))}
    </div>
  );
}
