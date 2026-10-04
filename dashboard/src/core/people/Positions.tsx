import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Lock, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Avatar, Banner, Button, Card, Dialog, EmptyState, IconButton, Input, Tooltip, toast, useConfirm } from '@teamhub/ui';
import { canWith, friendlyError, isMultiTeam, runtime, useMe, usePeople, usePositions, useSupabase, PersonPicker, TeamBadge, TeamScopePicker } from '@teamhub/sdk';

/** Positions = responsibilities ("Drive Coach"); Skills are proven abilities (spec §7.3, §13.9). */
export function Positions() {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const positions = usePositions();
  const people = usePeople();
  const [adding, setAdding] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTeam, setNewTeam] = useState<string | null>(null);
  const [pick, setPick] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const canCreate = canWith(me, 'people.assign_positions');
  const holders = (id: string) => [...(people.data?.values() ?? [])].filter((p) => p.positionIds.includes(id) && p.status === 'active');
  const refresh = () => qc.invalidateQueries({ queryKey: ['core'] });

  const skillsEnabled = runtime().modules.some((m) => m.manifest.id === 'skills');

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-4 sm:px-6">
      <Banner tone="info">
        A <strong>position</strong> is a responsibility (e.g. “3D Print Farm Manager”, “Drive Coach”). Tabs use positions for permissions and routing.
        {skillsEnabled && ' Proven abilities (e.g. “Certified driver”) belong in Skills & Training.'}
      </Banner>
      <div className="flex justify-end">
        {canCreate && (
          <Button icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            New badge position
          </Button>
        )}
      </div>
      {!positions.data?.length ? (
        <EmptyState icon={<BadgeCheck />} title="No positions yet" body="Positions are defined in setup (with permissions) or here (badges only)." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {positions.data.map((pos) => {
            const hs = holders(pos.id);
            const canAssign = canWith(me, 'people.assign_positions', pos.team_id) || (!pos.grants_permissions && canWith(me, 'people.assign_badges', pos.team_id));
            return (
              <Card key={pos.id} className="p-3.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {pos.name}
                      {pos.source === 'config' && (
                        <Tooltip content="Defined in setup (edit it with the wizard)">
                          <Lock className="size-3.5 text-faint" aria-label="Defined in setup" />
                        </Tooltip>
                      )}
                    </p>
                    <p className="text-[12px] text-muted">
                      {pos.grants_permissions ? 'Carries permissions' : 'Badge only'}
                      {isMultiTeam() && (
                        <>
                          {' · '}
                          <TeamBadge teamId={pos.team_id} />
                        </>
                      )}
                    </p>
                  </div>
                  {pos.source === 'app' && canWith(me, 'people.assign_positions', pos.team_id) && (
                    <IconButton label="Rename position" size="sm" onClick={() => setRenaming({ id: pos.id, name: pos.name })}>
                      <Pencil className="size-4" />
                    </IconButton>
                  )}
                  {pos.source === 'app' && canWith(me, 'people.assign_positions', pos.team_id) && (
                    <IconButton
                      label="Delete position"
                      size="sm"
                      className="text-danger"
                      onClick={async () => {
                        if (!(await confirm({ title: `Delete “${pos.name}”?`, body: 'It is removed from everyone who holds it.', danger: true, confirmLabel: 'Delete' }))) return;
                        const { error } = await sb.from('positions').delete().eq('id', pos.id);
                        if (error) toast.error(friendlyError(error));
                        refresh();
                      }}
                    >
                      <Trash2 className="size-4" />
                    </IconButton>
                  )}
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {hs.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 text-[13px]">
                      <Avatar name={h.name} src={h.avatarUrl} size={22} />
                      <span className="flex-1 truncate">{h.name}</span>
                      {canAssign && (
                        <IconButton
                          label={`Remove ${h.name}`}
                          size="sm"
                          onClick={async () => {
                            const { error } = await sb.from('position_holders').delete().match({ position_id: pos.id, user_id: h.id });
                            if (error) toast.error(friendlyError(error));
                            refresh();
                          }}
                        >
                          <X className="size-3.5" />
                        </IconButton>
                      )}
                    </li>
                  ))}
                  {!hs.length && <li className="text-[12.5px] text-faint">No one holds this yet</li>}
                </ul>
                {canAssign && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    icon={<Plus className="size-4" />}
                    onClick={() => {
                      setPick([]);
                      setAdding(pos.id);
                    }}
                  >
                    Assign
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={!!adding}
        onOpenChange={(v) => !v && setAdding(null)}
        title="Assign position"
        footer={
          <Button
            variant="primary"
            disabled={!pick.length}
            onClick={async () => {
              const { error } = await sb.rpc('people_assign_positions', { p_user: pick[0], p_positions: [adding] });
              if (error) return toast.error(friendlyError(error));
              setAdding(null);
              refresh();
            }}
          >
            Assign
          </Button>
        }
      >
        <PersonPicker value={pick} onChange={setPick} teamId={positions.data?.find((x) => x.id === adding)?.team_id ?? null} />
      </Dialog>

      <Dialog
        open={creating}
        onOpenChange={setCreating}
        title="New badge position"
        description="Badge-only positions show on profiles but don't carry permissions. Positions with permissions are defined in the setup wizard."
        footer={
          <Button
            variant="primary"
            disabled={!newName.trim()}
            onClick={async () => {
              const id = `pos_${newName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Math.random().toString(36).slice(2, 5)}`;
              const { error } = await sb.from('positions').insert({ id, name: newName.trim(), team_id: newTeam, grants_permissions: false, source: 'app' });
              if (error) return toast.error(friendlyError(error));
              setCreating(false);
              setNewName('');
              refresh();
            }}
          >
            Create
          </Button>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-[13px] font-medium">Name</span>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Pit Crew Lead" maxLength={60} />
          </label>
          <TeamScopePicker value={newTeam} onChange={setNewTeam} perm="people.assign_positions" label="Applies to" />
        </div>
      </Dialog>
      {renaming && (
        <Dialog
          open
          onOpenChange={(o) => !o && setRenaming(null)}
          title="Rename position"
          description="Everyone who holds it keeps it."
          footer={
            <Button
              variant="primary"
              onClick={async () => {
                if (!renaming.name.trim()) return toast.error('Enter a name');
                const { error } = await sb.from('positions').update({ name: renaming.name.trim().slice(0, 60) }).eq('id', renaming.id);
                if (error) return toast.error(friendlyError(error));
                setRenaming(null);
                refresh();
              }}
            >
              Save
            </Button>
          }
        >
          <Input autoFocus aria-label="Position name" maxLength={60} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
        </Dialog>
      )}
    </div>
  );
}
