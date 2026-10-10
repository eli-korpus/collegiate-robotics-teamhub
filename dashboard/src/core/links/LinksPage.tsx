import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Dialog, EmptyState, IconButton, LinkCard, PageHeader, SearchInput, matches, toast, useConfirm } from '@teamhub/ui';
import {
  canWith,
  friendlyError,
  isMultiTeam,
  LinkEditor,
  ScopeVisibility,
  TeamBadge,
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

const OTHER = 'Other links';

/**
 * The program's one links list (spec §10.6). Team tools (links with a kind) also show on Home and as quick links in
 * tabs; everything else lives here in sections. Everyone sees the page; edit buttons depend on core.add_links /
 * core.edit_links, and the database enforces the same rules.
 */
export default function LinksPage() {
  const links = useLinks();
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const scope = useTeamScope();
  const canManage = useCan('core.edit_links');
  const canAdd = useCan('core.add_links') || canManage;
  const [q, setQ] = useState('');
  const [creating, setCreating] = useNewParam();
  const [editing, setEditing] = useState<LinkRow | null>(null);
  useCreateShortcut(() => setCreating(true), canAdd);

  const all = links.data ?? [];
  const list = all.filter((l) => (!scope || !l.team_id || l.team_id === scope) && (!q || matches(`${l.label} ${l.url} ${l.description ?? ''} ${l.section ?? ''}`, q)));
  const tools = list.filter((l) => l.slot);
  const sections = useMemo(() => {
    const m = new Map<string, LinkRow[]>();
    for (const l of list.filter((x) => !x.slot)) m.set(l.section || OTHER, [...(m.get(l.section || OTHER) ?? []), l]);
    return [...m.entries()].sort(([a], [b]) => (a === OTHER ? 1 : b === OTHER ? -1 : a.localeCompare(b)));
  }, [list]);
  const allSections = [...new Set(all.map((l) => l.section).filter(Boolean) as string[])];
  const canEdit = (l: LinkRow) => canWith(me, 'core.edit_links', l.team_id) || (!l.slot && l.created_by === me.id && canWith(me, 'core.add_links', l.team_id));
  const refresh = () => qc.invalidateQueries({ queryKey: ['core', 'links'] });
  const close = () => (setCreating(false), setEditing(null));

  const card = (l: LinkRow) => (
    <LinkCard
      key={l.id}
      label={l.label}
      url={l.url}
      description={l.description}
      badge={
        l.slot || isMultiTeam() ? (
          <>
            {l.slot && <Badge>{TOOL_SLOT_LABELS[l.slot] ?? l.slot}</Badge>}
            {isMultiTeam() && <TeamBadge teamId={l.team_id} />}
          </>
        ) : undefined
      }
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
                const tool = l.slot ? ' It also disappears from Home and the tabs that show it.' : '';
                if (!(await confirm({ title: `Delete “${l.label}”?`, body: `This removes the link for everyone.${tool}`, danger: true, confirmLabel: 'Delete' }))) return;
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
      <PageHeader
        title="Links"
        icon={<Link2 />}
        subtitle="The team's tools and resources in one place"
        actions={
          canAdd && (
            <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
              Add link
            </Button>
          )
        }
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:px-6">
        {all.length > 0 && <SearchInput value={q} onChange={setQ} placeholder="Search links…" />}
        {tools.length > 0 && (
          <section>
            <h2 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">
              <Pin className="size-3.5" /> Team tools
            </h2>
            <p className="mb-2 text-[12.5px] text-muted">Also shown on Home and as quick links in the tabs that use them.</p>
            <div className="grid gap-2 md:grid-cols-2">{tools.map(card)}</div>
          </section>
        )}
        {sections.map(([name, ls]) => (
          <section key={name}>
            <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{name}</h2>
            <div className="grid gap-2 md:grid-cols-2">{ls.map(card)}</div>
          </section>
        ))}
        {!list.length && !links.isLoading && (
          <EmptyState
            icon={<Link2 />}
            title={q ? 'No links match' : 'No links yet'}
            body={q ? undefined : 'Links to your team chat, shared Drive, CAD, code and other resources go here. Discussion happens in your team chat: TeamHub has no chat by design.'}
            action={canAdd && !q ? <Button onClick={() => setCreating(true)}>Add the first link</Button> : undefined}
          />
        )}
      </div>
      <Dialog open={creating || !!editing} onOpenChange={(v) => !v && close()} title={editing ? 'Edit link' : 'Add a link'}>
        {(creating || editing) && (
          <div className="space-y-3">
            <LinkEditor
              initial={editing ?? { team_id: scope }}
              canSetKind={editing ? canWith(me, 'core.edit_links', editing.team_id) : canManage}
              sections={allSections}
              onCancel={close}
              onSave={async (v) => {
                const res = editing ? await sb.from('links').update(v).eq('id', editing.id) : await sb.from('links').insert({ ...v, created_by: me.id });
                if (res.error) return void toast.error(friendlyError(res.error));
                close();
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
