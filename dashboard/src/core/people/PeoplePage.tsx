import { useMemo, useState } from 'react';
import { Route, Routes, useNavigate, useSearchParams } from 'react-router';
import { Users } from 'lucide-react';
import { Avatar, EmptyState, PageHeader, PositionBadge, SearchInput, Segmented, Select, Spinner, TYPE_LABEL, TeamDot, cn, matches } from '@teamhub/ui';
import { isMultiTeam, runtime, useCan, usePeople, usePositions, useTeamScope, type PersonInfo } from '@teamhub/sdk';
import { Requests } from './Requests';
import { Positions } from './Positions';
import { RequestInfo } from './RequestInfo';
import { Profile } from './Profile';
import { splitChoices } from '../home/coreWidgets';

export default function PeoplePage() {
  return (
    <Routes>
      <Route path="/" element={<PeopleHome />} />
      <Route path="/:id" element={<Profile />} />
    </Routes>
  );
}

type Tab = 'directory' | 'requests' | 'positions' | 'request-info';

function PeopleHome() {
  const [params, setParams] = useSearchParams();
  const canApprove = useCan('people.approve_members');
  const canRequestInfo = useCan('people.request_info');
  const people = usePeople();
  const pending = [...(people.data?.values() ?? [])].filter((p) => p.memberships.some((m) => m.status === 'pending')).length;
  const tab = (params.get('tab') as Tab) || 'directory';
  const tabs = [
    { value: 'directory' as Tab, label: 'Directory' },
    ...(canApprove ? [{ value: 'requests' as Tab, label: pending ? `Requests (${pending})` : 'Requests' }] : []),
    { value: 'positions' as Tab, label: 'Positions' },
    ...(canRequestInfo ? [{ value: 'request-info' as Tab, label: 'Request info' }] : []),
  ];
  return (
    <div>
      <PageHeader title="People" icon={<Users />} subtitle="Everyone in the program, their roles and positions">
        <Segmented value={tab} onChange={(v) => setParams(v === 'directory' ? {} : { tab: v })} options={tabs} size="sm" />
      </PageHeader>
      {tab === 'directory' && <Directory />}
      {tab === 'requests' && canApprove && <Requests />}
      {tab === 'positions' && <Positions />}
      {tab === 'request-info' && canRequestInfo && <RequestInfo />}
    </div>
  );
}

const TYPE_ORDER = { mentor: 0, captain: 1, member: 2 } as const;

function Directory() {
  const people = usePeople();
  const positions = usePositions();
  const scope = useTeamScope();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [pos, setPos] = useState('');
  const [sub, setSub] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const teams = runtime().config.teams;
  const subteams = runtime().config.subteams;
  const hasSubteamField = runtime().config.profileFields.some((f) => f.id === 'subteam');

  const list = useMemo(
    () =>
      [...(people.data?.values() ?? [])].filter(
        (p) =>
          (showInactive ? p.status === 'inactive' : p.status === 'active') &&
          (!q || matches(`${p.name} ${p.positions.join(' ')}`, q)) &&
          (!pos || p.positionIds.includes(pos)) &&
          (!sub || splitChoices(p.details.subteam).some((x) => x === sub || x === subteams.find((s) => s.id === sub)?.name)),
      ),
    [people.data, q, pos, sub, showInactive, subteams],
  );

  if (people.isLoading) return <Spinner className="m-8" />;

  const groups = (scope ? teams.filter((t) => t.id === scope) : teams).map((t) => ({
    team: t,
    members: list
      .filter((p) => p.memberships.some((m) => m.team_id === t.id && m.status !== 'pending'))
      .sort((a, b) => {
        const ta = a.memberships.find((m) => m.team_id === t.id)!.type;
        const tb = b.memberships.find((m) => m.team_id === t.id)!.type;
        return TYPE_ORDER[ta] - TYPE_ORDER[tb] || a.name.localeCompare(b.name);
      }),
  }));
  const noTeam = list.filter((p) => !p.memberships.some((m) => m.status !== 'pending'));

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search people or positions…" className="min-w-56 flex-1" />
        <Select value={pos} onChange={(e) => setPos(e.target.value)} className="w-auto" aria-label="Filter by position">
          <option value="">All positions</option>
          {(positions.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {hasSubteamField && subteams.length > 0 && (
          <Select value={sub} onChange={(e) => setSub(e.target.value)} className="w-auto" aria-label="Filter by subteam">
            <option value="">All subteams</option>
            {subteams.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Former / inactive
        </label>
      </div>
      {!list.length ? (
        <EmptyState icon={<Users />} title="No one matches" body="Try a different search or filter." />
      ) : (
        <div className="space-y-6">
          {groups.map(
            (g) =>
              g.members.length > 0 && (
                <section key={g.team.id}>
                  {isMultiTeam() && (
                    <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
                      <TeamDot color={g.team.color} /> {g.team.name}
                      <span className="font-normal text-faint">{g.members.length}</span>
                    </h2>
                  )}
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.members.map((p) => (
                      <PersonCard key={p.id} p={p} teamId={g.team.id} onClick={() => nav(`/people/${p.id}`)} />
                    ))}
                  </ul>
                </section>
              ),
          )}
          {noTeam.length > 0 && (
            <section>
              <h2 className="mb-2 text-[13px] font-semibold text-muted">No team</h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {noTeam.map((p) => (
                  <PersonCard key={p.id} p={p} onClick={() => nav(`/people/${p.id}`)} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCard({ p, teamId, onClick }: { p: PersonInfo; teamId?: string; onClick: () => void }) {
  const m = teamId ? p.memberships.find((x) => x.team_id === teamId) : p.memberships[0];
  return (
    <li>
      <button type="button" onClick={onClick} className={cn('flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition-shadow hover:shadow-md')}>
        <Avatar name={p.name} src={p.avatarUrl} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold">{p.name}</span>
          <span className="block text-[12px] text-muted">
            {m ? TYPE_LABEL[m.type] : '–'}
            {p.isAdmin && ' · Admin'}
          </span>
          {p.positions.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {p.positions.slice(0, 3).map((x) => (
                <PositionBadge key={x} name={x} />
              ))}
              {p.positions.length > 3 && <span className="text-[11px] text-faint">+{p.positions.length - 3}</span>}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}
