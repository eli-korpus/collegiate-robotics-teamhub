import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { Timer } from 'lucide-react';
import { defaultSeasonLabel, seasonYear } from '@teamhub/config-schema/util';
import { Button, toast } from '@teamhub/ui';
import { canWith, friendlyError, runtime, setTeamScope, useMe, useSupabase, type IntegrationClient } from '@teamhub/sdk';

interface CompetitionEvent {
  kind: string;
  team_id: string | null;
  event_code: string | null;
}

/** "Open Competition Day" on a calendar competition: makes it the team's active event, then opens the page. */
function OpenCompetitionDay({ event, occurrence }: { event: CompetitionEvent; occurrence: { start: Date } }) {
  const sb = useSupabase();
  const me = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  if (event.kind !== 'competition' || !event.event_code) return null;
  // One-team programs may leave the team blank: it's then that team's competition.
  const teamId = event.team_id ?? runtime().config.teams.find((t) => t.number)?.id ?? null;
  if (!teamId) return null;
  const canSet = canWith(me, 'competition-day.set_event', teamId);
  return (
    <Button
      size="sm"
      icon={<Timer className="size-4" />}
      onClick={async () => {
        if (canSet) {
          const season = seasonYear(defaultSeasonLabel(occurrence.start));
          const { error } = await sb.from('comp_active').upsert({ team_id: teamId, event_code: event.event_code!.toUpperCase(), season, updated_by: me.id, updated_at: new Date().toISOString() });
          if (error) return toast.error(friendlyError(error));
          qc.invalidateQueries({ queryKey: ['competition-day'] });
        }
        setTeamScope(teamId);
        nav('/competition-day');
      }}
    >
      Open Competition Day
    </Button>
  );
}

const client: IntegrationClient = {
  id: 'competition-day+calendar',
  slots: { 'calendar.event.actions': OpenCompetitionDay },
};
export default client;
