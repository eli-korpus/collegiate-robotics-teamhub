import { useState } from 'react';
import { seasonYear } from '@teamhub/config-schema/util';
import { Field, Input, Select, formatDate, parseDate } from '@teamhub/ui';
import { runtime, useFtcTeamEvents, useSeason } from '@teamhub/sdk';

export interface PickedCompetition {
  code: string;
  name: string;
  start: string;
  end: string;
}

const OTHER = '__other';

/**
 * Which FTC competition a calendar event is: chosen from the competing team's FTCScout schedule (so the Events and
 * Competition Day pages can link to it), with typing a code as a fallback.
 */
export function CompetitionPicker({ teamId, code, onPick, onCode }: { teamId: string | null; code: string; onPick: (c: PickedCompetition) => void; onCode: (code: string) => void }) {
  const team = runtime().config.teams.find((t) => t.id === teamId) ?? (runtime().config.teams.length === 1 ? runtime().config.teams[0] : null);
  const season = seasonYear(useSeason());
  const events = useFtcTeamEvents(team?.number, season);
  const list = events.data ?? [];
  const known = !code || list.some((e) => e.eventCode === code.toUpperCase());
  const [typing, setTyping] = useState(!known);

  if (!team?.number) {
    return (
      <Field label="FTC event code" optional hint={team ? `Add ${team.name}'s team number in setup to pick from its FTCScout schedule.` : 'Pick the competing team first.'}>
        {(id) => <Input id={id} value={code} maxLength={20} onChange={(e) => onCode(e.target.value)} placeholder="e.g. USNYNYBRQ2" />}
      </Field>
    );
  }
  return (
    <Field
      label="Which competition"
      optional
      hint={`From ${team.name}'s ${season}–${String((season + 1) % 100).padStart(2, '0')} FTCScout schedule. Links this event to the Events and Competition Day pages.`}
    >
      {(id) => (
        <div className="space-y-2">
          <Select
            id={id}
            value={typing ? OTHER : code.toUpperCase()}
            onChange={(e) => {
              const v = e.target.value;
              if (v === OTHER) return setTyping(true);
              setTyping(false);
              const ev = list.find((x) => x.eventCode === v);
              if (ev) onPick({ code: ev.eventCode, name: ev.event.name, start: ev.event.start, end: ev.event.end });
              else onCode('');
            }}
          >
            <option value="">{events.isLoading ? 'Loading the schedule…' : list.length ? 'Choose a competition' : 'No competitions on FTCScout yet'}</option>
            {list.map((e) => (
              <option key={e.eventCode} value={e.eventCode}>
                {e.event.name} · {formatDate(parseDate(e.event.start), { month: 'short', day: 'numeric' })}
              </option>
            ))}
            <option value={OTHER}>Not listed: type the event code</option>
          </Select>
          {typing && <Input aria-label="FTC event code" value={code} maxLength={20} onChange={(e) => onCode(e.target.value)} placeholder="e.g. USNYNYBRQ2" />}
        </div>
      )}
    </Field>
  );
}
