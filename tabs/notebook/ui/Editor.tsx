import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { Badge, Button, Dialog, Field, IconButton, Input, Segmented, Select, Textarea, submitOnBlur, toDateInput, toast, type ProcessedFile } from '@teamhub/ui';
import {
  EntityLink,
  friendlyError,
  ModulePurpose,
  PersonPicker,
  ScopeVisibility,
  storagePath,
  TeamScopePicker,
  Upload,
  uploadFile,
  useMe,
  useSupabase,
  useTeamScope,
} from '@teamhub/sdk';
import { useNbSettings, useSubsystems, type Entry, type Matrix } from './data';

export interface EntryDraft {
  title?: string;
  kind?: 'log' | 'iteration';
  refs?: string[];
  subsystem_id?: string;
  body?: string;
}

export function EntryEditor({ entry, draft, onClose, imageCount = 0 }: { entry?: Entry | null; draft?: EntryDraft; onClose: (id?: string) => void; imageCount?: number }) {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const scope = useTeamScope();
  const settings = useNbSettings();
  const subsystems = useSubsystems();
  const [kind, setKind] = useState<'log' | 'iteration'>(entry?.kind ?? draft?.kind ?? 'log');
  const [v, setV] = useState({
    title: entry?.title ?? draft?.title ?? '',
    body: entry?.body ?? draft?.body ?? '',
    date: entry?.date ?? toDateInput(new Date()),
    team_id: entry ? entry.team_id : scope,
    subsystem_id: entry?.subsystem_id ?? draft?.subsystem_id ?? '',
    version_label: entry?.version_label ?? '',
    why: entry?.why ?? '',
    onshape_url: entry?.onshape_url ?? '',
    tags: entry?.tags ?? [],
    authors: entry?.authors ?? [me.id],
    refs: entry?.refs ?? draft?.refs ?? [],
  });
  const [matrix, setMatrix] = useState<Matrix | null>(entry?.decision_matrix ?? null);
  const [photos, setPhotos] = useState<ProcessedFile[]>([]);
  const [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(false);
  const max = (settings.maxPhotos ?? 6) - imageCount;

  const save = async () => {
    if (!v.title.trim()) return toast.error('Give the entry a title');
    if (v.onshape_url && !/^https?:\/\//.test(v.onshape_url)) return toast.error('The Onshape link must start with https://');
    setBusy(true);
    try {
      const id = entry?.id ?? crypto.randomUUID();
      const row = {
        ...v,
        kind,
        title: v.title.trim(),
        subsystem_id: v.subsystem_id || null,
        version_label: kind === 'iteration' ? v.version_label.trim() || null : null,
        why: kind === 'iteration' ? v.why.trim() || null : null,
        onshape_url: v.onshape_url.trim() || null,
        decision_matrix: kind === 'iteration' && matrix?.options.length ? matrix : null,
      };
      const res = entry ? await sb.from('nb_entries').update(row).eq('id', id) : await sb.from('nb_entries').insert({ ...row, id, created_by: me.id });
      if (res.error) throw res.error;
      for (const [i, p] of photos.entries()) {
        const path = await uploadFile('notebook', storagePath(v.team_id, id, p.name), p);
        const { error } = await sb.from('nb_images').insert({ entry_id: id, path, sort: imageCount + i });
        if (error) throw error;
      }
      qc.invalidateQueries({ queryKey: ['notebook'] });
      toast.success(entry ? 'Entry updated' : 'Entry added to the notebook');
      onClose(id);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const allTags = [...new Set([...(settings.tags ?? []), ...v.tags])];
  return (
    <Dialog
      open
      onOpenChange={(x) => !x && onClose()}
      size="xl"
      title={entry ? 'Edit entry' : 'New notebook entry'}
      footer={
        <>
          <Button onClick={() => onClose()}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Save entry
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!entry && <ModulePurpose moduleId="notebook" compact />}
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'log', label: 'Log entry: what we did & learned' },
            { value: 'iteration', label: 'Design iteration: a new version' },
          ]}
        />
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Title">{(id) => <Input id={id} autoFocus maxLength={160} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />}</Field>
          <Field label="Date">{(id) => <Input id={id} type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} />}</Field>
        </div>
        <TeamScopePicker value={v.team_id} onChange={(team_id) => setV({ ...v, team_id })} perm="notebook.write" label="Team" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subsystem" optional>
            {(id) => (
              <Select id={id} value={v.subsystem_id} onChange={(e) => setV({ ...v, subsystem_id: e.target.value })}>
                <option value="">None</option>
                {(subsystems.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Authors">{() => <PersonPicker multiple max={8} value={v.authors} onChange={(authors) => setV({ ...v, authors })} />}</Field>
        </div>
        {kind === 'iteration' && (
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Version">{(id) => <Input id={id} placeholder="v2" maxLength={20} value={v.version_label} onChange={(e) => setV({ ...v, version_label: e.target.value })} />}</Field>
            <Field label="Onshape link" optional>{(id) => <Input id={id} type="url" placeholder="https://cad.onshape.com/…" value={v.onshape_url} onChange={(e) => setV({ ...v, onshape_url: e.target.value })} />}</Field>
          </div>
        )}
        <Field label={kind === 'iteration' ? 'What changed' : 'What we did & learned'} hint="Formatting: **bold**, - lists, ### headings, [links](https://…)">
          {(id) => <Textarea id={id} rows={8} maxLength={20000} value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} />}
        </Field>
        {kind === 'iteration' && (
          <>
            <Field label="Why we changed it" hint="Judges look for the reasoning behind each design decision.">
              {(id) => <Textarea id={id} rows={3} maxLength={4000} value={v.why} onChange={(e) => setV({ ...v, why: e.target.value })} />}
            </Field>
            <MatrixEditor value={matrix} onChange={setMatrix} />
          </>
        )}
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            {allTags.map((t) => {
              const on = v.tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setV({ ...v, tags: on ? v.tags.filter((x) => x !== t) : [...v.tags, t] })} className={on ? 'rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-medium text-accent-fg' : 'rounded-full border border-border px-2.5 py-0.5 text-[12px] text-muted'}>
                  {t}
                </button>
              );
            })}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const t = newTag.trim().toLowerCase();
                if (t && !v.tags.includes(t)) setV({ ...v, tags: [...v.tags, t] });
                setNewTag('');
              }}
            >
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onBlur={submitOnBlur} placeholder="Add tag" className="h-7 w-28 text-[12px]" aria-label="New tag" />
            </form>
          </div>
        </div>
        {v.refs.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Linked items</p>
            <div className="flex flex-wrap gap-2">
              {v.refs.map((r) => (
                <span key={r} className="inline-flex items-center gap-1">
                  <EntityLink refStr={r} />
                  <IconButton label="Unlink" size="sm" className="size-6" onClick={() => setV({ ...v, refs: v.refs.filter((x) => x !== r) })}>
                    <X className="size-3" />
                  </IconButton>
                </span>
              ))}
            </div>
          </div>
        )}
        {max > 0 && (
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium">Photos {photos.length > 0 && <Badge>{photos.length} ready to upload</Badge>}</p>
            <Upload kind="photo" maxFiles={max - photos.length} onFiles={(f) => setPhotos([...photos, ...f].slice(0, max))} onLink={(url) => setV({ ...v, body: `${v.body}${v.body ? '\n\n' : ''}${url}` })} />
          </div>
        )}
        <ScopeVisibility teamId={v.team_id} />
      </div>
    </Dialog>
  );
}

function MatrixEditor({ value, onChange }: { value: Matrix | null; onChange: (m: Matrix | null) => void }) {
  if (!value)
    return (
      <Button size="sm" icon={<Plus className="size-4" />} onClick={() => onChange({ criteria: [{ name: 'Cost', weight: 1 }, { name: 'Reliability', weight: 2 }], options: [{ name: 'Option A', scores: [3, 3] }, { name: 'Option B', scores: [3, 3] }] })}>
        Add a decision matrix
      </Button>
    );
  const m = value;
  const setCrit = (i: number, patch: Partial<Matrix['criteria'][number]>) => onChange({ ...m, criteria: m.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium">Decision matrix (scores 1–5 × weight)</p>
        <IconButton label="Remove matrix" size="sm" onClick={() => onChange(null)}>
          <Trash2 className="size-4" />
        </IconButton>
      </div>
      <div className="overflow-x-auto">
        <table className="text-[12.5px]">
          <thead>
            <tr>
              <th />
              {m.criteria.map((c, i) => (
                <th key={i} className="p-1">
                  <Input value={c.name} onChange={(e) => setCrit(i, { name: e.target.value })} className="h-7 w-28 text-[12px]" aria-label="Criterion" />
                  <Input type="number" min={0} max={5} value={c.weight} onChange={(e) => setCrit(i, { weight: Number(e.target.value) })} className="mt-1 h-7 w-28 text-[12px]" aria-label="Weight" />
                </th>
              ))}
              <th className="p-1">
                <IconButton label="Add criterion" size="sm" onClick={() => onChange({ criteria: [...m.criteria, { name: 'Criterion', weight: 1 }], options: m.options.map((o) => ({ ...o, scores: [...o.scores, 3] })) })}>
                  <Plus className="size-4" />
                </IconButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {m.options.map((o, oi) => (
              <tr key={oi}>
                <td className="p-1">
                  <Input value={o.name} onChange={(e) => onChange({ ...m, options: m.options.map((x, j) => (j === oi ? { ...x, name: e.target.value } : x)) })} className="h-7 w-32 text-[12px]" aria-label="Option" />
                </td>
                {m.criteria.map((_, ci) => (
                  <td key={ci} className="p-1">
                    <Input
                      type="number"
                      min={1}
                      max={5}
                      value={o.scores[ci] ?? 3}
                      onChange={(e) => onChange({ ...m, options: m.options.map((x, j) => (j === oi ? { ...x, scores: x.scores.map((s, k) => (k === ci ? Number(e.target.value) : s)) } : x)) })}
                      className="h-7 w-28 text-[12px]"
                      aria-label={`Score for ${o.name}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => onChange({ ...m, options: [...m.options, { name: `Option ${String.fromCharCode(65 + m.options.length)}`, scores: m.criteria.map(() => 3) }] })}>
        Add option
      </Button>
    </div>
  );
}
