import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Download, ExternalLink, FileCheck2, Pencil, Plus } from 'lucide-react';
import { Banner, Button, Checkbox, Dialog, DueDate, EmptyState, Field, Input, Select, Spinner, Switch, downloadText, toCsv, toast, useConfirm } from '@teamhub/ui';
import { canWith, friendlyError, ModuleHeader, ModulePurpose, TeamScopePicker, useActivePeople, useCan, useMe, useRows, useSeason, useSupabase, useTeamScope, type PersonInfo } from '@teamhub/sdk';

export interface Item {
  id: string;
  team_id: string | null;
  name: string;
  url: string | null;
  due: string | null;
  season: string;
  applies_to: 'members' | 'everyone';
}
export interface Done {
  item_id: string;
  user_id: string;
  done_at: string;
}
export const useItems = (season: string) => useRows<Item>(['paperwork', 'items', season], (sb) => sb.from('ppr_items').select('*').eq('season', season).order('due', { nullsFirst: false }));
export const useDone = () => useRows<Done>(['paperwork', 'done'], (sb) => sb.from('ppr_done').select('item_id, user_id, done_at'));

export function appliesTo(p: PersonInfo, i: Item): boolean {
  return p.memberships.some((m) => m.status === 'active' && (i.team_id == null || m.team_id === i.team_id) && (i.applies_to === 'everyone' || m.type !== 'mentor'));
}

export default function PaperworkRoutes() {
  const season = useSeason();
  const items = useItems(season);
  const done = useDone();
  const me = useMe();
  const scope = useTeamScope();
  const people = useActivePeople(scope);
  const canManage = useCan('paperwork.manage');
  const canMark = useCan('paperwork.mark');
  const canAll = useCan('paperwork.view_all') || canMark;
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const sb = useSupabase();
  const qc = useQueryClient();
  const list = (items.data ?? []).filter((i) => !scope || !i.team_id || i.team_id === scope);
  const isDone = (item: string, user: string) => (done.data ?? []).some((d) => d.item_id === item && d.user_id === user);
  const mine = list.filter((i) => people.some((p) => p.id === me.id && appliesTo(p, i)) || me.memberships.some((m) => m.status === 'active' && (!i.team_id || m.team_id === i.team_id) && (i.applies_to === 'everyone' || m.type !== 'mentor')));
  const toggle = async (item: string, user: string, on: boolean) => {
    const res = on ? await sb.from('ppr_done').insert({ item_id: item, user_id: user, marked_by: me.id }) : await sb.from('ppr_done').delete().match({ item_id: item, user_id: user });
    if (res.error) return toast.error(friendlyError(res.error));
    qc.invalidateQueries({ queryKey: ['paperwork'] });
  };
  if (items.isLoading) return <Spinner className="m-8" />;
  const rows = people.filter((p) => list.some((i) => appliesTo(p, i))).filter((p) => !missingOnly || list.some((i) => appliesTo(p, i) && !isDone(i.id, p.id)));
  return (
    <div>
      <ModuleHeader moduleId="paperwork" actions={canManage && <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>Add required form</Button>} />
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6">
        <Banner tone="info">Hand in the paper copy or submit through the form's link. A mentor will check you off here. Never upload documents to TeamHub.</Banner>
        {!list.length ? (
          <EmptyState icon={<FileCheck2 />} title="No required paperwork this season" body={<ModulePurpose moduleId="paperwork" compact className="mt-2 text-left" />} />
        ) : (
          <>
            {mine.length > 0 && (
              <section>
                <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Your paperwork</h2>
                <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                  {mine.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px]">
                      {isDone(i.id, me.id) ? <Check className="size-5 text-success" /> : <span className="size-5 rounded-full border-2 border-warning" />}
                      <span className="flex-1">{i.name}</span>
                      <DueDate date={i.due} done={isDone(i.id, me.id)} />
                      {i.url && (
                        <a href={i.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline">
                          Get the form <ExternalLink className="size-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {canAll && (
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-[12px] font-semibold uppercase tracking-wider text-faint">Everyone</h2>
                  <Switch checked={missingOnly} onChange={setMissingOnly} label={<span className="text-[12.5px] font-normal">Only people missing something</span>} />
                  <span className="flex-1" />
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Download className="size-4" />}
                    onClick={() => downloadText(toCsv([['Name', ...list.map((i) => i.name)], ...rows.map((p) => [p.name, ...list.map((i) => (!appliesTo(p, i) ? 'n/a' : isDone(i.id, p.id) ? 'yes' : 'MISSING'))])]), `paperwork-${season}.csv`, 'text/csv')}
                  >
                    CSV
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                  <table className="w-full text-[13px]">
                    <thead className="bg-bg-subtle/60">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Person</th>
                        {list.map((i) => (
                          <th key={i.id} className="px-2 py-2 text-center font-medium">
                            <span className="inline-flex items-center gap-1">
                              {i.name}
                              {canManage && (
                                <button aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)} className="text-faint hover:text-fg">
                                  <Pencil className="size-3" />
                                </button>
                              )}
                            </span>
                            <span className="block text-[11px] font-normal text-faint">
                              {rows.filter((p) => appliesTo(p, i) && isDone(i.id, p.id)).length}/{people.filter((p) => appliesTo(p, i)).length}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((p) => (
                        <tr key={p.id}>
                          <td className="px-3 py-1.5">{p.name}</td>
                          {list.map((i) => (
                            <td key={i.id} className="text-center">
                              {appliesTo(p, i) ? (
                                <Checkbox
                                  size="lg"
                                  checked={isDone(i.id, p.id)}
                                  disabled={!canWith(me, 'paperwork.mark', i.team_id)}
                                  onChange={(v) => toggle(i.id, p.id, v)}
                                  label={<span className="sr-only">{`${p.name}: ${i.name}`}</span>}
                                />
                              ) : (
                                <span className="text-faint">–</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {editing && <ItemDialog item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ItemDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const [v, setV] = useState({ name: item?.name ?? '', url: item?.url ?? '', due: item?.due ?? '', applies_to: item?.applies_to ?? 'members', team_id: item ? item.team_id : scope });
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      title={item ? 'Edit required form' : 'Add required form'}
      footer={
        <>
          {item && (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={async () => {
                if (!(await confirm({ title: `Delete “${item.name}”?`, body: 'Its check-offs are deleted too.', danger: true, confirmLabel: 'Delete' }))) return;
                await sb.from('ppr_items').delete().eq('id', item.id);
                qc.invalidateQueries({ queryKey: ['paperwork'] });
                onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button
            variant="primary"
            onClick={async () => {
              if (!v.name.trim()) return toast.error('Name the form');
              if (v.url && !/^https?:\/\//.test(v.url)) return toast.error('Links must start with https://');
              const row = { ...v, name: v.name.trim(), url: v.url || null, due: v.due || null };
              const res = item ? await sb.from('ppr_items').update(row).eq('id', item.id) : await sb.from('ppr_items').insert(row);
              if (res.error) return toast.error(friendlyError(res.error));
              qc.invalidateQueries({ queryKey: ['paperwork'] });
              onClose();
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>{(id) => <Input id={id} autoFocus maxLength={120} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="FIRST Consent & Release" />}</Field>
        <Field label="Where to get it" optional hint="Link to the form (e.g. the FIRST dashboard or school website)">{(id) => <Input id={id} type="url" value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} />}</Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Due" optional>{(id) => <Input id={id} type="date" value={v.due} onChange={(e) => setV({ ...v, due: e.target.value })} />}</Field>
          <Field label="Who needs it">
            {(id) => (
              <Select id={id} value={v.applies_to} onChange={(e) => setV({ ...v, applies_to: e.target.value as 'members' })}>
                <option value="members">Students (members & captains)</option>
                <option value="everyone">Everyone, including mentors</option>
              </Select>
            )}
          </Field>
        </div>
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="paperwork.manage" label="Required for" />
      </div>
    </Dialog>
  );
}
