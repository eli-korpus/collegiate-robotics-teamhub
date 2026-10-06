import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, Handshake, Lock, Mail, Plus, Trash2 } from 'lucide-react';
import {
  Banner,
  Button,
  Checkbox,
  Dialog,
  DueDate,
  EmptyState,
  Field,
  Input,
  Kanban,
  KanbanCard,
  Segmented,
  Select,
  Spinner,
  StatusPill,
  Textarea,
  downloadText,
  toCsv,
  toast,
  useConfirm,
  validateRequired,
  safeHref,
} from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  ModuleHeader,
  ModulePurpose,
  NoAccess,
  PersonName,
  PersonPicker,
  TeamBadge,
  TeamScopePicker,
  useCan,
  useCreateShortcut,
  useLocalStorage,
  useMe,
  useNewParam,
  useRows,
  useSelectedParam,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';

export const STATUSES = [
  { id: 'prospect', label: 'Prospect', tone: 'neutral' },
  { id: 'asked', label: 'Asked', tone: 'info' },
  { id: 'committed', label: 'Committed', tone: 'success' },
  { id: 'declined', label: 'Declined', tone: 'danger' },
  { id: 'past', label: 'Past', tone: 'neutral' },
] as const;
export type Status = (typeof STATUSES)[number]['id'];

export interface Sponsor {
  id: string;
  team_id: string | null;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  website: string | null;
  status: Status;
  tier: string | null;
  gave: string | null;
  thanked: boolean;
  next_step: string | null;
  next_step_date: string | null;
  owner: string | null;
  notes: string | null;
}
export const useSponsors = (enabled = true) => useRows<Sponsor>(['sponsors', 'list'], (sb) => sb.from('spn_sponsors').select('*').order('name'), { enabled });

export default function SponsorsRoutes() {
  const canManage = useCan('sponsors.manage');
  const canView = useCan('sponsors.view') || canManage;
  const list = useSponsors(canView);
  const scope = useTeamScope();
  const sb = useSupabase();
  const qc = useQueryClient();
  const [view, setView] = useLocalStorage<'board' | 'list'>('teamhub-sponsors-view', 'board');
  const [creating, setCreating] = useNewParam();
  const [selected, setSelected] = useSelectedParam();
  useCreateShortcut(() => setCreating(true), canManage);
  if (!canView) return <NoAccess what="Sponsors" />;
  const rows = (list.data ?? []).filter((s) => !scope || !s.team_id || s.team_id === scope);
  const current = rows.find((s) => s.id === selected) ?? null;
  const move = async (s: Sponsor, to: string) => {
    if (s.status === to) return;
    const { error } = await sb.from('spn_sponsors').update({ status: to, updated_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['sponsors'] });
  };
  const exportCsv = () =>
    downloadText(
      toCsv([
        ['Name', 'Status', 'Tier', 'What they gave', 'Thanked', 'Contact', 'Email', 'Website', 'Next step', 'Next step date'],
        ...rows.map((s) => [s.name, s.status, s.tier ?? '', s.gave ?? '', s.thanked ? 'yes' : 'no', s.contact_name ?? '', s.contact_email ?? '', s.website ?? '', s.next_step ?? '', s.next_step_date ?? '']),
      ]),
      'sponsors.csv',
      'text/csv',
    );
  return (
    <div className="flex h-full flex-col">
      <ModuleHeader moduleId="sponsors" actions={canManage && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>Add sponsor</Button>}>
        <div className="flex items-center gap-2">
          <Segmented size="sm" value={view} onChange={setView} options={[{ value: 'board', label: 'Pipeline' }, { value: 'list', label: 'Follow-ups' }]} />
          <Button size="sm" variant="ghost" icon={<Download className="size-4" />} onClick={exportCsv}>
            CSV
          </Button>
        </div>
      </ModuleHeader>
      <p className="flex items-center gap-1.5 px-4 pt-3 text-[12.5px] text-muted sm:px-6">
        <Lock className="size-3.5" /> Only captains and mentors can see this tab. Track what sponsors gave in words: TeamHub doesn't do money accounting.
      </p>
      {list.isLoading ? (
        <Spinner className="m-8" />
      ) : !rows.length ? (
        <EmptyState icon={<Handshake />} title="No sponsors yet" body={<ModulePurpose moduleId="sponsors" compact className="mt-2 text-left" />} />
      ) : view === 'board' ? (
        <div className="min-h-0 flex-1">
          <Kanban
            columns={STATUSES.map((st) => ({ id: st.id, title: st.label, items: rows.filter((s) => s.status === st.id) }))}
            keyOf={(s) => s.id}
            onMove={canManage ? (s, to) => move(s, to) : undefined}
            render={(s) => (
              <KanbanCard onClick={() => setSelected(s.id)}>
                <p className="text-[13.5px] font-medium">{s.name}</p>
                {s.gave && <p className="text-[12px] text-muted">{s.gave}</p>}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11.5px]">
                  {s.tier && <StatusPill label={s.tier} />}
                  {s.status === 'committed' && !s.thanked && <StatusPill label="Not thanked yet" tone="warning" />}
                  {s.next_step_date && <DueDate date={s.next_step_date} />}
                  <TeamBadge teamId={s.team_id} />
                </div>
              </KanbanCard>
            )}
          />
        </div>
      ) : (
        <FollowUps rows={rows} onOpen={setSelected} />
      )}
      {(creating || current) && <SponsorDialog sponsor={creating ? null : current} canManage={canManage} onClose={() => (creating ? setCreating(false) : setSelected(null))} />}
    </div>
  );
}

/** Next steps sorted by date, plus committed sponsors who haven't been thanked. */
function FollowUps({ rows, onOpen }: { rows: Sponsor[]; onOpen: (id: string) => void }) {
  const steps = rows.filter((s) => s.next_step || s.next_step_date).sort((a, b) => (a.next_step_date ?? '9999').localeCompare(b.next_step_date ?? '9999'));
  const thank = rows.filter((s) => s.status === 'committed' && !s.thanked);
  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
      {thank.length > 0 && (
        <Banner tone="warning" title={`Say thank you to ${thank.length} sponsor${thank.length === 1 ? '' : 's'}`}>
          {thank.map((s, i) => (
            <span key={s.id}>
              {i > 0 && ', '}
              <button className="font-medium text-accent hover:underline" onClick={() => onOpen(s.id)}>
                {s.name}
              </button>
            </span>
          ))}
        </Banner>
      )}
      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
        {steps.map((s) => (
          <li key={s.id}>
            <button className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-subtle" onClick={() => onOpen(s.id)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{s.name}</span>
                <span className="block text-[12.5px] text-muted">{s.next_step || '–'}</span>
              </span>
              {s.owner && (
                <span className="text-[12px] text-muted">
                  <PersonName id={s.owner} />
                </span>
              )}
              <DueDate date={s.next_step_date} />
            </button>
          </li>
        ))}
        {!steps.length && <li className="px-4 py-3 text-[13px] text-faint">No next steps planned.</li>}
      </ul>
    </div>
  );
}

function SponsorDialog({ sponsor, canManage, onClose }: { sponsor: Sponsor | null; canManage: boolean; onClose: () => void }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const editable = canManage && (!sponsor || canWith(me, 'sponsors.manage', sponsor.team_id));
  const [v, setV] = useState({
    name: sponsor?.name ?? '',
    contact_name: sponsor?.contact_name ?? '',
    contact_email: sponsor?.contact_email ?? '',
    website: sponsor?.website ?? '',
    status: sponsor?.status ?? ('prospect' as Status),
    tier: sponsor?.tier ?? '',
    gave: sponsor?.gave ?? '',
    thanked: sponsor?.thanked ?? false,
    next_step: sponsor?.next_step ?? '',
    next_step_date: sponsor?.next_step_date ?? '',
    owner: sponsor?.owner ?? me.id,
    notes: sponsor?.notes ?? '',
    team_id: sponsor ? sponsor.team_id : scope,
  });
  const save = async () => {
    if (!validateRequired()) return;
    if (!v.name.trim()) return toast.error('Name the sponsor');
    if (v.website && !/^https?:\/\//i.test(v.website)) return toast.error('Website must start with https://');
    const t = (x: string) => x.trim() || null;
    const body = { name: v.name.trim(), contact_name: t(v.contact_name), contact_email: t(v.contact_email), website: t(v.website), status: v.status, tier: t(v.tier), gave: t(v.gave), thanked: v.thanked, next_step: t(v.next_step), next_step_date: v.next_step_date || null, owner: v.owner, notes: t(v.notes), team_id: v.team_id, updated_at: new Date().toISOString() };
    const { error } = sponsor ? await sb.from('spn_sponsors').update(body).eq('id', sponsor.id) : await sb.from('spn_sponsors').insert(body);
    if (error) return toast.error(friendlyError(error));
    qc.invalidateQueries({ queryKey: ['sponsors'] });
    onClose();
  };
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={sponsor ? sponsor.name : 'Add sponsor'}
      size="lg"
      footer={
        editable && (
          <>
            {sponsor && (
              <Button
                variant="ghost"
                className="mr-auto text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (!(await confirm({ title: `Delete ${sponsor.name}?`, danger: true, confirmLabel: 'Delete' }))) return;
                  await sb.from('spn_sponsors').delete().eq('id', sponsor.id);
                  qc.invalidateQueries({ queryKey: ['sponsors'] });
                  onClose();
                }}
              >
                Delete
              </Button>
            )}
            <Button variant="primary" onClick={save}>
              Save
            </Button>
          </>
        )
      }
    >
      <fieldset disabled={!editable} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sponsor" required>{(id) => <Input id={id} autoFocus={!sponsor} maxLength={120} value={v.name} onChange={set('name')} />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={v.status} onChange={set('status')}>
                {STATUSES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Tier" optional hint="e.g. Gold, In-kind">{(id) => <Input id={id} maxLength={40} value={v.tier} onChange={set('tier')} />}</Field>
          <Field label="What they gave" optional hint="In words: “$500 + machine time”">{(id) => <Input id={id} maxLength={300} value={v.gave} onChange={set('gave')} />}</Field>
        </div>
        <Checkbox checked={v.thanked} onChange={(c) => setV({ ...v, thanked: c })} label="Thank-you sent" />
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
            <Lock className="size-3.5" /> Contact: visible to captains and mentors only
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Contact name" optional>{(id) => <Input id={id} maxLength={120} value={v.contact_name} onChange={set('contact_name')} />}</Field>
            <Field label="Email" optional>
              {(id) => (
                <div className="flex gap-1">
                  <Input id={id} type="email" maxLength={200} value={v.contact_email} onChange={set('contact_email')} />
                  {v.contact_email && (
                    <a className="grid place-items-center px-1 text-muted hover:text-fg" href={`mailto:${v.contact_email}`} aria-label="Email them">
                      <Mail className="size-4" />
                    </a>
                  )}
                </div>
              )}
            </Field>
            <Field label="Website" optional>
              {(id) => (
                <div className="flex gap-1">
                  <Input id={id} type="url" value={v.website} onChange={set('website')} placeholder="https://" />
                  {v.website && (
                    <a className="grid place-items-center px-1 text-muted hover:text-fg" href={safeHref(v.website)} target="_blank" rel="noreferrer" aria-label="Open website">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </div>
              )}
            </Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
          <Field label="Next step" optional>{(id) => <Input id={id} maxLength={300} value={v.next_step} onChange={set('next_step')} placeholder="Send the season recap" />}</Field>
          <Field label="By" optional>{(id) => <Input id={id} type="date" value={v.next_step_date} onChange={set('next_step_date')} />}</Field>
        </div>
        <Field label="Owner" optional>{() => <PersonPicker value={v.owner ? [v.owner] : []} onChange={([o]) => setV({ ...v, owner: o ?? null })} teamId={v.team_id} />}</Field>
        <Field label="Notes" optional>{(id) => <Textarea id={id} rows={3} maxLength={4000} value={v.notes} onChange={set('notes')} />}</Field>
        <TeamScopePicker value={v.team_id} onChange={(t) => setV({ ...v, team_id: t })} perm="sponsors.manage" />
      </fieldset>
    </Dialog>
  );
}
