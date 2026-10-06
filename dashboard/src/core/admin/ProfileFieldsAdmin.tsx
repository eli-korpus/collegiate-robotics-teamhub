import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { fieldLevel, type FieldLevel } from '@teamhub/config-schema/util';
import { Badge, Banner, Button, Card, Dialog, Field, IconButton, Input, Select, Spinner, TagListInput, toast, useConfirm, validateRequired } from '@teamhub/ui';
import { friendlyError, runtime, useSettingsRow, useSupabase, type ExtraProfileField } from '@teamhub/sdk';

const LEVEL_LABEL: Record<FieldLevel, string> = {
  everyone: 'Everyone in the program',
  leaders: 'Captains and mentors only',
  mentors: 'Mentors only',
};

/**
 * Admin > Profile fields: fields from setup are listed (change them in the setup wizard); simple extra fields can be
 * added, renamed and removed here without opening the wizard.
 */
export function ProfileFieldsAdmin() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const settings = useSettingsRow();
  const [editing, setEditing] = useState<{ index: number | null; field: ExtraProfileField } | null>(null);
  const base = runtime().config.profileFields;
  const extra = settings.data?.extra_profile_fields ?? [];

  const save = async (next: ExtraProfileField[]) => {
    const { error } = await sb.from('teamhub_settings').update({ extra_profile_fields: next }).eq('id', 1);
    if (error) {
      toast.error(friendlyError(error));
      return false;
    }
    qc.invalidateQueries({ queryKey: ['core', 'settings'] });
    return true;
  };

  if (settings.isLoading) return <Spinner />;
  return (
    <div className="max-w-2xl space-y-4 text-[13.5px]">
      <p className="text-muted">
        Extra info on each person’s profile. People fill these in on My profile; mentors can ask for missing answers with People &gt; Request info. Keep personal data to what you
        really need (FIRST Youth Protection).
      </p>

      <Card className="p-4">
        <p className="mb-2 font-semibold">From setup</p>
        {base.length ? (
          <ul className="divide-y divide-border">
            {base.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 font-medium">{f.label}</span>
                <LevelBadge level={fieldLevel(f)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">None.</p>
        )}
        <p className="mt-2 text-[12.5px] text-muted">
          To change these, or who can see them, run <code>npm run setup</code> and choose <strong>Edit</strong> &gt; People.
        </p>
      </Card>

      <Card className="p-4">
        <p className="mb-2 font-semibold">Added here</p>
        {extra.length ? (
          <ul className="divide-y divide-border">
            {extra.map((f, i) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1">
                  <span className="font-medium">{f.label}</span>
                  {f.type === 'select' && f.options?.length ? <span className="text-muted"> · {f.options.join(', ')}</span> : null}
                </span>
                <LevelBadge level={fieldLevel(f)} />
                <IconButton label={`Edit ${f.label}`} size="sm" onClick={() => setEditing({ index: i, field: f })}>
                  <Pencil className="size-4" />
                </IconButton>
                <IconButton
                  label={`Remove ${f.label}`}
                  size="sm"
                  onClick={async () => {
                    if (!(await confirm({ title: `Remove “${f.label}”?`, body: 'It disappears from every profile. Answers people already gave are kept, so adding it back with the same name brings them back.', danger: true, confirmLabel: 'Remove' }))) return;
                    if (await save(extra.filter((_, j) => j !== i))) toast.success('Field removed');
                  }}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">None yet.</p>
        )}
        <Button className="mt-3" icon={<Plus className="size-4" />} onClick={() => setEditing({ index: null, field: { id: '', label: '', type: 'text', options: [], visibility: 'everyone' } })}>
          Add a field
        </Button>
      </Card>

      {editing && (
        <FieldDialog
          initial={editing.field}
          isNew={editing.index === null}
          taken={[...base.map((f) => f.id), ...extra.filter((_, j) => j !== editing.index).map((f) => f.id)]}
          onClose={() => setEditing(null)}
          onSave={async (f) => {
            const next = editing.index === null ? [...extra, f] : extra.map((x, j) => (j === editing.index ? f : x));
            if (await save(next)) {
              toast.success(editing.index === null ? 'Field added' : 'Field saved');
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: FieldLevel }) {
  return level === 'everyone' ? (
    <Badge>{LEVEL_LABEL.everyone}</Badge>
  ) : (
    <Badge tone="warning">
      <Lock className="size-3" /> {LEVEL_LABEL[level]}
    </Badge>
  );
}

const idFor = (label: string) =>
  'x_' +
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);

function FieldDialog({ initial, isNew, taken, onClose, onSave }: { initial: ExtraProfileField; isNew: boolean; taken: string[]; onClose: () => void; onSave: (f: ExtraProfileField) => Promise<void> }) {
  const [label, setLabel] = useState(initial.label);
  const [type, setType] = useState<'text' | 'select'>(initial.type === 'select' ? 'select' : 'text');
  const [options, setOptions] = useState<string[]>(initial.options ?? []);
  const [level, setLevel] = useState<FieldLevel>(fieldLevel(initial));
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Add a profile field' : `Edit ${initial.label}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              if (!validateRequired()) return;
              const id = isNew ? idFor(label) : initial.id;
              if (id === 'x_') return toast.error('Use letters or numbers in the name');
              if (taken.includes(id)) return toast.error('There is already a field with that name');
              if (type === 'select' && !options.length) return toast.error('Add at least one choice');
              setBusy(true);
              await onSave({ id, label: label.trim().slice(0, 60), type, options: type === 'select' ? options : [], visibility: level });
              setBusy(false);
            }}
          >
            {isNew ? 'Add field' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          {(id) => <Input id={id} value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Hoodie size" />}
        </Field>
        <Field label="Answer">
          {(id) => (
            <Select id={id} value={type} onChange={(e) => setType(e.target.value as 'text' | 'select')}>
              <option value="text">Typed answer</option>
              <option value="select">Pick one from a list</option>
            </Select>
          )}
        </Field>
        {type === 'select' && (
          <div role="group" aria-label="Choices" className="space-y-1.5">
            <p className="text-[13px] font-medium">Choices</p>
            <TagListInput value={options} onChange={setOptions} label="Choice" />
          </div>
        )}
        {isNew ? (
          <Field label="Who can see the answers" hint="People always see their own answers, and admins see everything. This can't be changed later, so pick carefully.">
            {(id) => (
              <Select id={id} value={level} onChange={(e) => setLevel(e.target.value as FieldLevel)}>
                {(Object.keys(LEVEL_LABEL) as FieldLevel[]).map((l) => (
                  <option key={l} value={l}>
                    {LEVEL_LABEL[l]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        ) : (
          <Banner tone="info">Seen by: {LEVEL_LABEL[level].toLowerCase()}. This can't be changed for a field added here; remove it and add a new one instead.</Banner>
        )}
      </div>
    </Dialog>
  );
}
