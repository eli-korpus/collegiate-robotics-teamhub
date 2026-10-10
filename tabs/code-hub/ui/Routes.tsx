import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Code2, ExternalLink, Gamepad2, GitCommitHorizontal, GitPullRequest, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Dialog,
  EmptyState,
  Field,
  Input,
  RelativeTime,
  Segmented,
  Select,
  Spinner,
  StatusPill,
  Textarea,
  toast,
  useConfirm,
  safeHref,
} from '@teamhub/ui';
import { canWith, friendlyError, ModuleHeader, ModulePurpose, Slot, TeamBadge, TeamScopePicker, useCan, useLinks, useMe, useRows, useSupabase, useTeamScope } from '@teamhub/sdk';
import { CONTROL_LABEL, CONTROLS, Gamepad, type Control } from './Gamepad';

interface OpMode {
  id: string;
  team_id: string | null;
  name: string;
  kind: 'auto' | 'teleop' | 'test';
  description: string | null;
  status: 'working' | 'wip' | 'broken' | 'retired';
  gamepad_map: { gamepad1?: Partial<Record<Control, string>>; gamepad2?: Partial<Record<Control, string>> };
  sort: number;
  updated_at: string;
}
const STATUS = { working: { l: 'Working', t: 'success' as const }, wip: { l: 'In progress', t: 'info' as const }, broken: { l: 'Broken', t: 'danger' as const }, retired: { l: 'Retired', t: 'neutral' as const } };

/** Public GitHub repo activity, cached 5 minutes (spec §14.3). Private repos just show the link. */
function useGithub(url: string | undefined) {
  const m = url && /github\.com\/([^/]+)\/([^/#?]+)/.exec(url);
  const repo = m ? `${m[1]}/${m[2].replace(/\.git$/, '')}` : null;
  return useQuery({
    queryKey: ['github', repo],
    enabled: !!repo,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const [c, p] = await Promise.all([fetch(`https://api.github.com/repos/${repo}/commits?per_page=8`), fetch(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`)]);
      if (c.status === 404) return { repo, private: true as const, commits: [], pulls: [] };
      if (!c.ok) throw new Error(c.status === 403 ? 'GitHub rate limit reached. Try again in a few minutes.' : `GitHub error ${c.status}`);
      return {
        repo,
        private: false as const,
        commits: (await c.json()) as { sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } } }[],
        pulls: p.ok ? ((await p.json()) as { number: number; title: string; html_url: string; user: { login: string }; created_at: string }[]) : [],
      };
    },
  });
}

export default function CodeHubRoutes() {
  const links = useLinks();
  const repoUrl = links.data?.find((l) => l.slot === 'code_repo')?.url;
  const gh = useGithub(repoUrl);
  const ops = useRows<OpMode>(['code-hub', 'opmodes'], (sb) => sb.from('code_opmodes').select('*').order('kind').order('sort').order('name'));
  const scope = useTeamScope();
  const canEdit = useCan('code-hub.edit');
  const me = useMe();
  const [editing, setEditing] = useState<OpMode | 'new' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const list = (ops.data ?? []).filter((o) => !scope || !o.team_id || o.team_id === scope);
  const current = list.find((o) => o.id === selected) ?? list.find((o) => o.kind === 'teleop' && o.status !== 'retired') ?? null;
  return (
    <div>
      <ModuleHeader moduleId="code-hub" actions={canEdit && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add OpMode</Button>} />
      <div className="mx-auto grid grid-cols-1 max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader icon={<Code2 className="size-4" />} title="OpModes" />
            {ops.isLoading ? (
              <Spinner className="m-4" />
            ) : !list.length ? (
              <EmptyState className="py-6" title="No OpModes listed" body={<ModulePurpose moduleId="code-hub" compact className="mt-2 text-left" />} />
            ) : (
              <ul className="divide-y divide-border">
                {list.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => setSelected(o.id)} className={`flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-bg-subtle max-sm:flex-wrap max-sm:gap-y-1.5 ${current?.id === o.id ? 'bg-accent-soft/50' : ''}`}>
                      <Badge>{o.kind === 'auto' ? 'Auto' : o.kind === 'teleop' ? 'TeleOp' : 'Test'}</Badge>
                      <span className="min-w-0 flex-1 max-sm:basis-[calc(100%-5rem)]">
                        <span className="block font-medium max-lg:break-words">{o.name}</span>
                        {o.description && <span className="block truncate text-[12.5px] text-muted">{o.description}</span>}
                      </span>
                      <TeamBadge teamId={o.team_id} />
                      <StatusPill label={STATUS[o.status].l} tone={STATUS[o.status].t} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          {current && (
            <Card>
              <CardHeader
                icon={<Gamepad2 className="size-4" />}
                title={`Controls: ${current.name}`}
                action={canWith(me, 'code-hub.edit', current.team_id) && <Button size="sm" variant="ghost" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(current)}>Edit</Button>}
              />
              <div className="space-y-4 px-4 pb-4">
                {(['gamepad1', 'gamepad2'] as const).map((g) =>
                  Object.keys(current.gamepad_map?.[g] ?? {}).length ? <Gamepad key={g} map={current.gamepad_map[g]!} title={g === 'gamepad1' ? 'Gamepad 1 (driver)' : 'Gamepad 2 (operator)'} /> : null,
                )}
                {!Object.keys(current.gamepad_map?.gamepad1 ?? {}).length && !Object.keys(current.gamepad_map?.gamepad2 ?? {}).length && <p className="text-[13px] text-faint">No controls mapped yet.</p>}
                <Slot name="code-hub.opmode.actions" props={{ opmode: current }} />
              </div>
            </Card>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader icon={<GitCommitHorizontal className="size-4" />} title="Repository" subtitle={gh.data?.repo ?? undefined} />
          <div className="px-4 pb-4 text-[13px]">
            {!repoUrl ? (
              <p className="text-muted">Add your GitHub repository as the “Code repository” team tool on the Links page to see recent commits here.</p>
            ) : !gh.data && gh.isLoading ? (
              <Spinner />
            ) : gh.error ? (
              <Banner tone="warning">{(gh.error as Error).message}</Banner>
            ) : !gh.data || gh.data.private ? (
              <p className="text-muted">
                This repository is private (or not on GitHub), so activity can't be shown.{' '}
                <a className="text-accent hover:underline" href={safeHref(repoUrl)} target="_blank" rel="noreferrer">
                  Open it <ExternalLink className="inline size-3" aria-hidden />
                </a>
              </p>
            ) : (
              <>
                {gh.data.pulls.length > 0 && (
                  <>
                    <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">Open pull requests</p>
                    <ul className="mb-3 space-y-1">
                      {gh.data.pulls.map((p) => (
                        <li key={p.number}>
                          <a href={safeHref(p.html_url)} target="_blank" rel="noreferrer" className="flex items-start gap-1.5 hover:underline">
                            <GitPullRequest className="mt-0.5 size-3.5 shrink-0 text-success" /> #{p.number} {p.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-faint">Recent commits</p>
                <ul className="space-y-1.5">
                  {gh.data.commits.map((c) => (
                    <li key={c.sha}>
                      <a href={safeHref(c.html_url)} target="_blank" rel="noreferrer" className="block hover:underline">
                        <span className="block truncate">{c.commit.message.split('\n')[0]}</span>
                        <span className="text-[11.5px] text-faint">
                          {c.commit.author.name} · <RelativeTime date={c.commit.author.date} />
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>
      {editing && <OpModeDialog op={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OpModeDialog({ op, onClose }: { op: OpMode | null; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const [v, setV] = useState({ name: op?.name ?? '', kind: op?.kind ?? 'teleop', description: op?.description ?? '', status: op?.status ?? 'wip', team_id: op ? op.team_id : scope });
  const [map, setMap] = useState(op?.gamepad_map ?? {});
  const [pad, setPad] = useState<'gamepad1' | 'gamepad2'>('gamepad1');
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      size="lg"
      title={op ? `Edit ${op.name}` : 'Add OpMode'}
      footer={
        <>
          {op && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              icon={<Trash2 className="size-4" />}
              onClick={async () => {
                if (!(await confirm({ title: `Delete ${op.name}?`, danger: true, confirmLabel: 'Delete' }))) return;
                const { error } = await sb.from('code_opmodes').delete().eq('id', op.id);
                if (error) return toast.error(friendlyError(error));
                qc.invalidateQueries({ queryKey: ['code-hub'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!v.name.trim()) return toast.error('Name the OpMode');
              const row = { ...v, name: v.name.trim(), description: v.description || null, gamepad_map: map, updated_at: new Date().toISOString() };
              const res = op ? await sb.from('code_opmodes').update(row).eq('id', op.id) : await sb.from('code_opmodes').insert(row);
              if (res.error) return toast.error(friendlyError(res.error));
              qc.invalidateQueries({ queryKey: ['code-hub'] });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Name" required className="sm:col-span-3">{(id) => <Input id={id} autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="MainTeleOp" />}</Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value as 'auto' })}>
                <option value="teleop">TeleOp</option>
                <option value="auto">Autonomous</option>
                <option value="test">Test</option>
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as 'wip' })}>
                {Object.entries(STATUS).map(([k, s]) => (
                  <option key={k} value={k}>
                    {s.l}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div>
            <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="code-hub.edit" label="Team" />
          </div>
        </div>
        <Field label="What it does" optional>{(id) => <Textarea id={id} rows={2} maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />}</Field>
        {v.kind !== 'auto' && (
          <div className="space-y-2">
            <Segmented size="sm" value={pad} onChange={setPad} options={[{ value: 'gamepad1', label: 'Gamepad 1' }, { value: 'gamepad2', label: 'Gamepad 2' }]} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CONTROLS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-[12.5px]">
                  <span className="w-32 shrink-0 text-muted">{CONTROL_LABEL[c]}</span>
                  <Input className="h-8" value={map[pad]?.[c] ?? ''} placeholder="Not used" onChange={(e) => setMap({ ...map, [pad]: { ...map[pad], [c]: e.target.value || undefined } })} />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
