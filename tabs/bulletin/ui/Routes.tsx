import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, IconButton, LinkCard, SearchInput, matches, toast, useConfirm } from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  LinkEditor,
  ModuleHeader,
  ModulePurpose,
  ScopeVisibility,
  TOOL_SLOT_LABELS,
  useCan,
  useCreateShortcut,
  useLinks,
  useMe,
  useNewParam,
  useSupabase,
  useTeamScope,
  type LinkRow,
} from '@teamhub/sdk';

/** The full, sectioned, searchable view of the one links table (spec §13.3, §10.6). */
export default function BulletinRoutes() {
  const links = useLinks();
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const canPost = useCan('bulletin.post');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useNewParam();
  const [editing, setEditing] = useState<LinkRow | null>(null);
  useCreateShortcut(() => setCreating(true), canPost);

  const list = (links.data ?? []).filter((l) => (!scope || !l.team_id || l.team_id === scope) && (!q || matches(`${l.label} ${l.url} ${l.description ?? ''} ${l.section ?? ''}`, q)));
  const pinned = list.filter((l) => l.slot);
  const sections = useMemo(() => {
    const m = new Map<string, LinkRow[]>();
    for (const l of list.filter((x) => !x.slot)) m.set(l.section || 'Other links', [...(m.get(l.section || 'Other links') ?? []), l]);
    return [...m.entries()].sort(([a], [b]) => (a === 'Other links' ? 1 : b === 'Other links' ? -1 : a.localeCompare(b)));
  }, [list]);
  const allSections = [...new Set((links.data ?? []).map((l) => l.section).filter(Boolean) as string[])];
  const canEdit = (l: LinkRow) => !l.slot && ((l.created_by === me.id && canWith(me, 'bulletin.post', l.team_id)) || canWith(me, 'bulletin.manage', l.team_id));
  const refresh = () => qc.invalidateQueries({ queryKey: ['core', 'links'] });

  const card = (l: LinkRow) => (
    <LinkCard
      key={l.id}
      label={l.label}
      url={l.url}
      description={l.description}
      badge={l.slot ? <Badge>{TOOL_SLOT_LABELS[l.slot] ?? l.slot}</Badge> : undefined}
      actions={
        canEdit(l) ? (
          <>
            <IconButton label="Edit link" size="sm" onClick={() => setEditing(l)}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton
              label="Delete link"
              size="sm"
              onClick={async () => {
                if (!(await confirm({ title: `Remove “${l.label}”?`, danger: true, confirmLabel: 'Remove' }))) return;
                const { error } = await sb.from('links').delete().eq('id', l.id);
                if (error) toast.error(friendlyError(error));
                refresh();
              }}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </>
        ) : undefined
      }
    />
  );

  return (
    <div>
      <ModuleHeader
        moduleId="bulletin"
        actions={
          canPost && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Add link
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:px-6">
        <SearchInput value={q} onChange={setQ} placeholder="Search links…" />
        {pinned.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">
              <Pin className="size-3.5" /> Team tools
            </h2>
            <div className="grid gap-2 md:grid-cols-2">{pinned.map(card)}</div>
          </section>
        )}
        {sections.map(([name, ls]) => (
          <section key={name}>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{name}</h2>
            <div className="grid gap-2 md:grid-cols-2">{ls.map(card)}</div>
          </section>
        ))}
        {!list.length && (
          <EmptyState icon={<Pin />} title={q ? 'No links match' : 'No links yet'} body={<ModulePurpose moduleId="bulletin" compact className="mt-2 text-left" />} action={canPost && !q ? <Button onClick={() => setCreating(true)}>Add the first link</Button> : undefined} />
        )}
      </div>
      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && (setCreating(false), setEditing(null))} title={editing ? 'Edit link' : 'Add a link'}>
        {(creating || editing) && (
          <div className="space-y-3">
            {!editing && <ModulePurpose moduleId="bulletin" compact />}
            <LinkEditor
              initial={editing ?? { team_id: scope }}
              showSection
              sections={allSections}
              onCancel={() => (setCreating(false), setEditing(null))}
              onSave={async (v) => {
                const row = { ...v, slot: null };
                const res = editing ? await sb.from('links').update(row).eq('id', editing.id) : await sb.from('links').insert({ ...row, created_by: me.id });
                if (res.error) return void toast.error(friendlyError(res.error));
                setCreating(false);
                setEditing(null);
                refresh();
              }}
            />
            <ScopeVisibility teamId={editing?.team_id ?? scope} />
          </div>
        )}
      </Dialog>
    </div>
  );
}
