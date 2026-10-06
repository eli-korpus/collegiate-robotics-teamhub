import { lazy, Suspense, useMemo, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { Button, formatDate, greeting } from '@teamhub/ui';
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
  const order = prefs?.order?.length ? prefs.order : defaultOrder(me);
  const hidden = new Set(prefs?.hidden ?? []);
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : 1000 + all.findIndex((w) => w.key === k));
  const visible = all.filter((w) => !hidden.has(w.key)).sort((a, b) => rank(a.key) - rank(b.key));
  const today = visible.filter((w) => w.priority === 'today');
  const grid = visible.filter((w) => w.priority !== 'today');
  const first = me.profile.display_name.split(' ')[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
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

      <Masonry items={grid.map((w) => ({ key: w.key, node: <WidgetSlot w={w} teamId={teamId} /> }))} />

      {editing && (
        <Suspense fallback={null}>
          <CustomizeDialog open={editing} onOpenChange={setEditing} all={all} order={visible.map((w) => w.key).concat(all.filter((w) => hidden.has(w.key)).map((w) => w.key))} hidden={hidden} />
        </Suspense>
      )}
    </div>
  );
}

function WidgetSlot({ w, teamId }: { w: HomeWidget; teamId: string | null }) {
  const C = w.component;
  return (
    <div>
      <Suspense fallback={<div className="h-28 animate-pulse rounded-lg bg-bg-subtle" />}>
        <C teamId={teamId} />
      </Suspense>
    </div>
  );
}

