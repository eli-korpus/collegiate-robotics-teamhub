import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, BarChart3, CalendarRange, Check, Eye, EyeOff, Lock, MessageSquareText, Pencil, Plus, Trash2, Vote, X } from 'lucide-react';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  RelativeTime,
  SmartGroupList,
  Spinner,
  StatusPill,
  Textarea,
  VisibilityNote,
  addDays,
  cn,
  formatDate,
  toDateInput,
  toDateTimeInput,
  toast,
  useConfirm,
} from '@teamhub/ui';
import {
  canWith,
  EntityLink,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  PersonName,
  runtime,
  ScopeVisibility,
  TeamChatLink,
  TeamScopePicker,
  teamById,
  useCan,
  useCreateShortcut,
  useMe,
  useNewParam,
  usePeople,
  useRows,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

type Visibility = 'public' | 'results' | 'private';
type Kind = 'choice' | 'availability' | 'text';
interface AvailOptions {
  dates: string[];
  slots: string[];
}
export interface Poll {
  id: string;
  team_id: string | null;
  kind: Kind;
  question: string;
  options: string[] | AvailOptions;
  multi: boolean;
  visibility: Visibility;
  closes_at: string | null;
  result: Totals | null;
  ref: string | null;
  created_by: string | null;
  created_at: string;
}
interface Totals {
  counts: number[];
  voters: number;
}
interface VoteRow {
  poll_id: string;
  user_id: string;
  value: number[] | string;
}

export const isOpen = (p: Poll) => !p.closes_at || new Date(p.closes_at) > new Date();
export const usePolls = () => useRows<Poll>(['polls', 'list'], (sb) => sb.from('poll_polls').select('*').order('created_at', { ascending: false }));
export const useMyVotes = () => {
  const me = useMe();
  return useRows<VoteRow>(['polls', 'mine'], (sb) => sb.from('poll_votes').select('*').eq('user_id', me.id));
};

const VIS: Record<Visibility, { title: string; body: string; icon: typeof Eye; example: string }> = {
  public: { title: 'Public', body: 'Everyone who can see the poll sees who answered what.', icon: Eye, example: '“Pizza or tacos?”' },
  results: { title: 'Results only', body: 'Everyone sees the totals; only you and mentors see who answered what.', icon: BarChart3, example: '“Which robot design should we build?”' },
  private: { title: 'Private', body: 'Only you and mentors see the results and answers.', icon: EyeOff, example: '“How is practice going for you?”' },
};

/** "Visible to …" line computed from the poll's real visibility rule (spec §10.8). */
export function pollVisibility(p: Pick<Poll, 'visibility' | 'team_id'>): { text: string; locked: boolean } {
  const scope = teamById(p.team_id)?.name ?? runtime().config.program.name;
  if (p.visibility === 'public') return { text: `Public: everyone in ${scope} sees your answer`, locked: false };
  if (p.visibility === 'results') return { text: 'Only totals are shown to others — your answer is visible to you, the poll creator and mentors', locked: true };
  return { text: 'Private: only you, the poll creator and mentors see your answer', locked: true };
}

const PERSONAL = /\b(size|shirt|allerg|dietary|diet|phone|address|emergency|medical|birthday|birth date|contact)\b/i;

export default function PollsRoutes() {
  const polls = usePolls();
  const votes = useMyVotes();
  const scope = useTeamScope();
  const canCreate = useCan('polls.create');
  const [creating, setCreating, params] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canCreate);
  const list = (polls.data ?? []).filter((p) => !scope || !p.team_id || p.team_id === scope);
  const voted = new Set((votes.data ?? []).map((v) => v.poll_id));
  const current = list.find((p) => p.id === selected) ?? null;
  const groups = [
    { id: 'todo', title: 'Waiting for your answer', tone: 'warning' as const, items: list.filter((p) => isOpen(p) && !voted.has(p.id)) },
    { id: 'open', title: 'Open', items: list.filter((p) => isOpen(p) && voted.has(p.id)) },
    { id: 'closed', title: 'Closed', items: list.filter((p) => !isOpen(p)), collapsed: true },
  ];
  return (
    <div>
      <ModuleHeader moduleId="polls" actions={canCreate && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>New poll</Button>} />
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        {polls.isLoading ? (
          <Spinner />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <SmartGroupList
              groups={groups}
              keyOf={(p) => p.id}
              empty={<EmptyState icon={<Vote />} title="No polls yet" body={<ModulePurpose moduleId="polls" compact className="mt-2 text-left" />} />}
              render={(p) => {
                const V = VIS[p.visibility];
                return (
                  <ListRow onClick={() => setSelected(p.id)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{p.question}</p>
                      <p className="flex items-center gap-1.5 text-[12px] text-muted">
                        <V.icon className="size-3.5" /> {V.title} · {p.kind === 'availability' ? 'Find a time' : p.kind === 'text' ? 'Short answer' : p.multi ? 'Pick several' : 'Pick one'} · <PersonName id={p.created_by} />
                        {p.closes_at && isOpen(p) && <> · closes {formatDate(p.closes_at)}</>}
                      </p>
                    </div>
                    {voted.has(p.id) && <StatusPill label="Answered" tone="success" />}
                  </ListRow>
                );
              }}
            />
          </div>
        )}
      </div>
      {creating && <CreatePoll eventRef={params.get('ref')} onClose={() => setCreating(false)} />}
      {current && votes.isSuccess && <PollDialog key={current.id} poll={current} myVote={votes.data?.find((v) => v.poll_id === current.id) ?? null} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CreatePoll({ eventRef, onClose }: { eventRef: string | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const [visibility, setVisibility] = useState<Visibility | null>(null);
  const [kind, setKind] = useState<Kind>('choice');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [dates, setDates] = useState<string[]>([0, 1, 2, 3, 4].map((d) => toDateInput(addDays(new Date(), d + 1))));
  const [slots, setSlots] = useState('3–5 PM, 5–7 PM');
  const [closes, setCloses] = useState(toDateTimeInput(addDays(new Date(), 3)));
  const [teamId, setTeamId] = useState<string | null>(scope);
  const personal = PERSONAL.test(question);
  const save = async () => {
    if (!question.trim()) return toast.error('Write the question');
    const opts = kind === 'choice' ? options.map((o) => o.trim()).filter(Boolean) : kind === 'availability' ? { dates: [...dates].sort(), slots: slots.split(',').map((s) => s.trim()).filter(Boolean) } : [];
    if (kind === 'choice' && (opts as string[]).length < 2) return toast.error('Add at least two options');
    const { error } = await sb.from('poll_polls').insert({ team_id: teamId, kind, question: question.trim(), options: opts, multi: kind === 'choice' && multi, visibility, closes_at: closes ? new Date(closes).toISOString() : null, ref: eventRef, created_by: me.id });
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['polls'] });
    toast.success('Poll created');
    onClose();
  };
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="New poll" size="lg" footer={visibility && <Button variant="primary" onClick={save}>Create poll</Button>}>
      {!visibility ? (
        <div className="space-y-3">
          <ModulePurpose moduleId="polls" compact />
          <p className="text-[14px] font-semibold">First: who should see the answers?</p>
          {(Object.keys(VIS) as Visibility[]).map((v) => {
            const V = VIS[v];
            return (
              <button key={v} type="button" onClick={() => (setVisibility(v), v === 'public' && kind === 'text' && setKind('choice'))} className="flex w-full items-start gap-3 rounded-lg border border-border bg-surface p-4 text-left hover:border-accent">
                <V.icon className="mt-0.5 size-5 text-accent" />
                <span>
                  <span className="block text-[15px] font-semibold">{V.title}</span>
                  <span className="block text-[13px] text-muted">{V.body}</span>
                  <span className="mt-0.5 block text-[12px] text-faint">e.g. {V.example}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          <VisibilityNote locked={visibility !== 'public'}>
            {VIS[visibility].title}: {VIS[visibility].body}{' '}
            <button className="text-accent hover:underline" onClick={() => setVisibility(null)}>
              Change
            </button>
          </VisibilityNote>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['choice', 'Choice', Vote],
                ['availability', 'Find a time', CalendarRange],
                ...(visibility !== 'public' ? [['text', 'Short answer', MessageSquareText]] : []),
              ] as [Kind, string, typeof Vote][]
            ).map(([k, l, I]) => (
              <Button key={k} variant={kind === k ? 'soft' : 'secondary'} icon={<I className="size-4" />} onClick={() => setKind(k)}>
                {l}
              </Button>
            ))}
          </div>
          <TeamScopePicker value={teamId} onChange={setTeamId} perm="polls.create" label="Ask" />
          {eventRef && (
            <p className="text-[13px] text-muted">
              About: <EntityLink refStr={eventRef} />
            </p>
          )}
          <Field label="Question">{(id) => <Input id={id} autoFocus maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={kind === 'availability' ? 'When can everyone come to the build session?' : 'What should we…'} />}</Field>
          {personal && (
            <Banner tone="warning" title="This looks like personal info">
              Collect it with <strong>People &gt; Request info</strong> instead — answers save privately to each profile and you'll see who's missing.{' '}
              <a href="/people?tab=request-info" className="font-medium text-accent hover:underline">
                Use Request info <ArrowRight className="inline size-3.5" aria-hidden />
              </a>
            </Banner>
          )}
          {kind === 'choice' && (
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={o} maxLength={120} placeholder={`Option ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                  {options.length > 2 && (
                    <IconButton label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </IconButton>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOptions([...options, ''])} disabled={options.length >= 12}>
                  Add option
                </Button>
                <Checkbox checked={multi} onChange={setMulti} label="People can pick several" />
              </div>
            </div>
          )}
          {kind === 'availability' && (
            <div className="space-y-2">
              <p className="text-[13px] font-medium">Days</p>
              <div className="flex flex-wrap gap-2">
                {dates.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <Input type="date" className="w-40" value={d} onChange={(e) => setDates(dates.map((x, j) => (j === i ? e.target.value : x)))} />
                    <IconButton label="Remove day" size="sm" onClick={() => setDates(dates.filter((_, j) => j !== i))}>
                      <X className="size-3.5" />
                    </IconButton>
                  </span>
                ))}
                <Button size="sm" onClick={() => setDates([...dates, toDateInput(addDays(new Date(dates.at(-1) ?? new Date()), 1))])}>
                  Add day
                </Button>
              </div>
              <Field label="Time slots" hint="Separate with commas">{(id) => <Input id={id} value={slots} onChange={(e) => setSlots(e.target.value)} />}</Field>
            </div>
          )}
          <Field label="Closes" optional>{(id) => <Input id={id} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />}</Field>
          <ScopeVisibility teamId={teamId} suffix="(the question)" />
        </div>
      )}
    </Dialog>
  );
}

function PollDialog({ poll: p, myVote, onClose }: { poll: Poll; myVote: VoteRow | null; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const people = usePeople();
  const open = isOpen(p);
  const canVote = open && canWith(me, 'polls.vote', p.team_id);
  const canSeeVotes = p.created_by === me.id || canWith(me, 'polls.view_private_results', p.team_id) || p.visibility === 'public';
  const totals = useQuery({ queryKey: ['polls', 'totals', p.id], queryFn: async () => (await sb.rpc('poll_totals', { p_poll: p.id })).data as Totals | null });
  const all = useRows<VoteRow>(['polls', 'votes', p.id], (s) => s.from('poll_votes').select('*').eq('poll_id', p.id), { enabled: canSeeVotes });
  const choice = Array.isArray(p.options) ? p.options : [];
  const avail = !Array.isArray(p.options) ? p.options : { dates: [], slots: [] };
  const cells = avail.dates.length * avail.slots.length;
  const [sel, setSel] = useState<number[]>(Array.isArray(myVote?.value) ? myVote!.value : []);
  const [bits, setBits] = useState<string>(typeof myVote?.value === 'string' && p.kind === 'availability' ? myVote.value.padEnd(cells, '0') : '0'.repeat(cells));
  const [text, setText] = useState(typeof myVote?.value === 'string' && p.kind === 'text' ? myVote.value : '');
  const vis = pollVisibility(p);
  const refresh = () => qc.invalidateQueries({ queryKey: ['polls'] });
  const submit = async () => {
    const value = p.kind === 'choice' ? sel : p.kind === 'availability' ? bits : text.trim();
    if (p.kind === 'choice' && !sel.length) return toast.error('Pick an option');
    const { error } = await sb.from('poll_votes').upsert({ poll_id: p.id, user_id: me.id, value: JSON.stringify(value) === '""' ? '' : value, voted_at: new Date().toISOString() });
    if (error) return toast.error(friendlyError(error));
    toast.success('Answer saved');
    refresh();
  };
  const t = totals.data;
  const [editing, setEditing] = useState(false);
  const max = Math.max(1, ...(t?.counts ?? [0]));
  const voterNames = useMemo(() => new Map([...(people.data?.values() ?? [])].map((x) => [x.id, x])), [people.data]);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={p.question}
      description={<>{open ? (p.closes_at ? `Closes ${new Date(p.closes_at).toLocaleString()}` : 'Open') : 'Closed'} · asked by <PersonName id={p.created_by} /></>}
      size="lg"
      footer={
        <>
          {(p.created_by === me.id || me.isAdmin) && (
            <>
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (!(await confirm({ title: 'Delete this poll?', danger: true, confirmLabel: 'Delete' }))) return;
                  await sb.from('poll_polls').delete().eq('id', p.id);
                  refresh();
                  onClose();
                }}
              >
                Delete
              </Button>
              {open && (
                <Button
                  onClick={async () => {
                    await sb.from('poll_polls').update({ closes_at: new Date().toISOString() }).eq('id', p.id);
                    refresh();
                  }}
                >
                  Close now
                </Button>
              )}
              {open && t && t.voters === 0 && (
                <Button icon={<Pencil className="size-4" />} onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </>
          )}
          {canVote && (
            <Button variant="primary" onClick={submit}>
              {myVote ? 'Update answer' : 'Submit'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <VisibilityNote locked={vis.locked}>{vis.text}</VisibilityNote>
        {p.ref && (
          <p className="text-[13px] text-muted">
            About: <EntityLink refStr={p.ref} />
          </p>
        )}
        {p.kind === 'choice' && (
          <ul className="space-y-2">
            {choice.map((o, i) => {
              const on = sel.includes(i);
              const n = t?.counts[i] ?? 0;
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!canVote}
                    onClick={() => setSel(p.multi ? (on ? sel.filter((x) => x !== i) : [...sel, i]) : [i])}
                    className={cn('relative w-full overflow-hidden rounded-lg border p-3 text-left text-[14px]', on ? 'border-accent' : 'border-border', canVote && 'hover:border-accent')}
                  >
                    {t && <span className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${(n / max) * 100}%` }} />}
                    <span className="relative flex items-center gap-2">
                      <span className={cn('grid size-5 place-items-center border-2', p.multi ? 'rounded' : 'rounded-full', on ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong')}>{on && <Check className="size-3.5" aria-hidden />}</span>
                      <span className="flex-1 font-medium">{o}</span>
                      {t && <span className="tabular text-muted">{n}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {p.kind === 'availability' && (
          <div className="overflow-x-auto">
            <table className="text-[12.5px]">
              <thead>
                <tr>
                  <th />
                  {avail.dates.map((d) => (
                    <th key={d} className="px-1 pb-1 font-medium">
                      {formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {avail.slots.map((s, si) => (
                  <tr key={s}>
                    <td className="pr-2 text-muted">{s}</td>
                    {avail.dates.map((d, di) => {
                      const idx = di * avail.slots.length + si;
                      const on = bits[idx] === '1';
                      const n = t?.counts[idx] ?? 0;
                      const best = t && n === max && n > 0;
                      return (
                        <td key={d} className="p-0.5">
                          <button
                            type="button"
                            disabled={!canVote}
                            aria-pressed={on}
                            aria-label={`${s} on ${d}`}
                            onClick={() => setBits(bits.slice(0, idx) + (on ? '0' : '1') + bits.slice(idx + 1))}
                            className={cn('h-10 w-24 rounded-md border text-[12px]', on ? 'border-success bg-success-soft font-semibold text-success' : 'border-border bg-surface', best && 'ring-2 ring-accent')}
                          >
                            {on && 'I can'} {t && <span className="tabular text-muted">{on ? '· ' : ''}{n}</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {t && <p className="mt-1 text-[12px] text-muted">Outlined = most people available.</p>}
          </div>
        )}
        {p.kind === 'text' && canVote && <Textarea rows={3} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer" />}
        {t ? <p className="text-[12.5px] text-muted">{t.voters} answered</p> : p.visibility === 'private' && <p className="flex items-center gap-1 text-[12.5px] text-muted"><Lock className="size-3.5" /> Results are private.</p>}
        {canSeeVotes && (all.data?.length ?? 0) > 0 && p.kind !== 'availability' && (
          <Card className="p-3">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Who answered what</p>
            <ul className="space-y-1.5 text-[13px]">
              {all.data!.map((v) => {
                const person = voterNames.get(v.user_id);
                return (
                  <li key={v.user_id} className="flex items-start gap-2">
                    <Avatar name={person?.name ?? '?'} src={person?.avatarUrl} size={20} />
                    <span className="font-medium">{person?.name ?? 'Former member'}:</span>
                    <span className="text-muted">{Array.isArray(v.value) ? v.value.map((i) => choice[i]).join(', ') : v.value}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
        <TeamChatLink prefix="Want to discuss it?" />
        <p className="text-[11.5px] text-faint">
          Individual answers are deleted 30 days after the poll closes; totals stay. Created <RelativeTime date={p.created_at} />.
        </p>
      </div>
      {editing && <EditPoll poll={p} onClose={() => setEditing(false)} />}
    </Dialog>
  );
}

/** Fix a typo in the question or choices — only until someone answers (the database enforces this too). */
function EditPoll({ poll: p, onClose }: { poll: Poll; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [question, setQuestion] = useState(p.question);
  const [options, setOptions] = useState<string[]>(Array.isArray(p.options) ? p.options : []);
  const [closes, setCloses] = useState(p.closes_at ? toDateTimeInput(new Date(p.closes_at)) : '');
  const save = async () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) return toast.error('Write the question');
    if (p.kind === 'choice' && clean.length < 2) return toast.error('Keep at least two options');
    const { error } = await sb
      .from('poll_polls')
      .update({ question: question.trim(), ...(p.kind === 'choice' ? { options: clean } : {}), closes_at: closes ? new Date(closes).toISOString() : null })
      .eq('id', p.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['polls'] });
    toast.success('Poll updated');
    onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Edit poll" description="You can change the question and choices until someone answers." footer={<Button variant="primary" onClick={save}>Save</Button>}>
      <div className="space-y-3">
        <Field label="Question">{(id) => <Input id={id} maxLength={300} value={question} onChange={(e) => setQuestion(e.target.value)} />}</Field>
        {p.kind === 'choice' && (
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <Input value={o} maxLength={120} aria-label={`Option ${i + 1}`} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))} />
                {options.length > 2 && (
                  <IconButton label="Remove option" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
                    <X className="size-4" />
                  </IconButton>
                )}
              </div>
            ))}
            <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setOptions([...options, ''])} disabled={options.length >= 12}>
              Add option
            </Button>
          </div>
        )}
        <Field label="Closes" optional>{(id) => <Input id={id} type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}
