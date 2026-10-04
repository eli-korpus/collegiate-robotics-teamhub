import { useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { Banner, EmptyState, Segmented, Spinner } from '@teamhub/ui';
import { ModuleHeader, ModulePurpose, useCan, useLocalStorage, useSeason } from '@teamhub/sdk';
import { EventPicker } from './EventPicker';
import { useEventContext } from './event';
import { EventView, LiveBadge } from './EventView';
import { Forms } from './Forms';
import { Insights, TeamProfile } from './Insights';
import { PickList } from './PickList';
import { Scout } from './Scout';
import { TeamChecklist } from './Checklist';
import { useScoutingStats, useTemplates } from './stats';

type Tab = 'event' | 'teams' | 'scout' | 'insights' | 'picklist' | 'forms';

export default function ScoutingRoutes() {
  const season = useSeason();
  const canForms = useCan('scouting.manage_template');
  const [tab, setTab] = useLocalStorage<Tab>('teamhub-scouting-tab', 'event');
  const [event, setEvent] = useLocalStorage<string>('teamhub-scouting-event', '');
  const [team, setTeam] = useState<number | null>(null);
  const [compare, setCompare] = useState<number[]>([]);
  const [target, setTarget] = useState<{ kind: 'pit' | 'match'; team: number; n: number } | null>(null);
  const templates = useTemplates(season);
  const ctx = useEventContext(event || null);
  const stats = useScoutingStats(ctx, templates.data ?? []);
  return (
    <div>
      <ModuleHeader moduleId="scouting" subtitle={event ? ctx.name : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <EventPicker value={event} name={ctx.name} onChange={setEvent} />
          <Segmented
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'event', label: 'Event' },
              { value: 'teams', label: 'Teams' },
              { value: 'scout', label: 'Scout' },
              { value: 'insights', label: 'Insights' },
              { value: 'picklist', label: 'Pick list' },
              ...(canForms ? [{ value: 'forms' as Tab, label: 'Forms' }] : []),
            ]}
          />
          {event && tab !== 'event' && <LiveBadge ctx={ctx} />}
        </div>
      </ModuleHeader>
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {tab === 'forms' ? (
          <Forms templates={templates.data ?? []} season={season} />
        ) : !event ? (
          <EmptyState icon={<ScanSearch />} title="Choose the competition" body={<>Pick your event above: teams, rankings, matches and awards load automatically.<ModulePurpose moduleId="scouting" compact className="mt-3 text-left" /></>} />
        ) : ctx.loading || templates.isLoading ? (
          <Spinner />
        ) : (
          <>
            {ctx.source === 'none' && <Banner tone="warning" className="mb-4" title={`“${event}” isn't on FTCScout`}>Check the event code, or add the event and its team list with “It's not on FTCScout”.</Banner>}
            {tab === 'event' && <EventView ctx={ctx} stats={stats} onTeam={setTeam} />}
            {tab === 'teams' && <TeamChecklist ctx={ctx} stats={stats} onTeam={setTeam} onScout={(kind, n) => (setTarget({ kind, team: n, n: Date.now() }), setTab('scout'))} />}
            {tab === 'scout' && <Scout key={target?.n} initial={target} ctx={ctx} stats={stats} templates={templates.data ?? []} canForms={canForms} goForms={() => setTab('forms')} />}
            {tab === 'insights' && <Insights ctx={ctx} stats={stats} onTeam={setTeam} compare={compare} setCompare={setCompare} />}
            {tab === 'picklist' && <PickList ctx={ctx} stats={stats} onTeam={setTeam} />}
          </>
        )}
      </div>
      {team != null && <TeamProfile n={team} ctx={ctx} stats={stats} templates={templates.data ?? []} onClose={() => setTeam(null)} />}
    </div>
  );
}
