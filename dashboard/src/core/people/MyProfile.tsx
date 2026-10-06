import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Trash2, UserPlus } from 'lucide-react';
import { Avatar, Button, Card, CardHeader, Field, Input, PageHeader, Select, Textarea, VisibilityNote, downloadText, toast, useConfirm, validateRequired } from '@teamhub/ui';
import { friendlyError, isMultiTeam, runtime, useMe, usePeople, useSupabase, Upload, uploadFile } from '@teamhub/sdk';
import { LEVEL_NOTE, ProfileFieldInput, fieldValue, saveProfileFields, useMyPrivate, useProfileFields } from './profileFields';

export default function MyProfile() {
  const sb = useSupabase();
  const me = useMe();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const fields = useProfileFields();
  const priv = useMyPrivate();
  const people = usePeople();
  const [name, setName] = useState(me.profile.display_name);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [joinTeam, setJoinTeam] = useState('');
  const [joinType, setJoinType] = useState('member');
  const [joinNote, setJoinNote] = useState('');

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.id, fieldValue(f, me.profile.details, priv.data)])));
  }, [fields, priv.data, me.profile.details]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['core'] });
  const otherTeams = runtime().config.teams.filter((t) => !me.memberships.some((m) => m.team_id === t.id));

  return (
    <div>
      <PageHeader title="My profile" subtitle="How you appear across TeamHub" />
      <div className="mx-auto grid max-w-4xl gap-4 px-4 py-5 sm:px-6 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader title="Name & photo" />
          <div className="flex flex-wrap items-start gap-5 px-4 pb-4">
            <Avatar name={name} src={people.data?.get(me.id)?.avatarUrl} size={72} />
            <div className="min-w-60 flex-1 space-y-3">
              <Field label="Display name" required>{(id) => <Input id={id} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
              <Upload
                kind="avatar"
                label="Drop a photo or"
                onFiles={async ([f]) => {
                  try {
                    const path = `${me.id}/${crypto.randomUUID()}.webp`;
                    await uploadFile('avatars', path, f);
                    const old = me.profile.avatar_path;
                    const { error } = await sb.from('profiles').update({ avatar_path: path }).eq('id', me.id);
                    if (error) throw error;
                    if (old) await sb.storage.from('avatars').remove([old]);
                    toast.success('Photo updated');
                    refresh();
                  } catch (e) {
                    toast.error(friendlyError(e));
                  }
                }}
              />
              {me.profile.avatar_path && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await sb.storage.from('avatars').remove([me.profile.avatar_path!]);
                    await sb.from('profiles').update({ avatar_path: null }).eq('id', me.id);
                    refresh();
                  }}
                >
                  Remove photo
                </Button>
              )}
              <VisibilityNote>Your name and photo are visible to everyone in {runtime().config.program.name}.</VisibilityNote>
            </div>
          </div>
        </Card>

        {fields.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader title="Profile details" />
            <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.id} role="group" aria-label={f.label} className="space-y-1.5">
                  <p className="text-[13px] font-medium">{f.label}</p>
                  <ProfileFieldInput field={f} value={values[f.id] ?? ''} onChange={(v) => setValues({ ...values, [f.id]: v })} />
                  <VisibilityNote locked={f.private}>{LEVEL_NOTE[f.level]}</VisibilityNote>
                </div>
              ))}
            </div>
          </Card>
        )}
        <div className="flex justify-end md:col-span-2">
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                if (name.trim() && name.trim() !== me.profile.display_name) {
                  const { error } = await sb.from('profiles').update({ display_name: name.trim() }).eq('id', me.id);
                  if (error) throw error;
                }
                await saveProfileFields(sb, me.id, fields, values, { details: me.profile.details ?? {}, hidden: priv.data ?? { leaders: {}, mentors: {} } });
                toast.success('Profile saved');
                refresh();
              } catch (e) {
                toast.error(friendlyError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save profile
          </Button>
        </div>

        {isMultiTeam() && otherTeams.length > 0 && (
          <Card>
            <CardHeader icon={<UserPlus className="size-4" />} title="Join another team" />
            <form
              className="space-y-2.5 px-4 pb-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!validateRequired(e.currentTarget)) return;
                const { error } = await sb.from('memberships').insert({ user_id: me.id, team_id: joinTeam, type: joinType, requested_type: joinType, status: 'pending', note: joinNote || null });
                if (error) return toast.error(friendlyError(error));
                toast.success('Request sent');
                refresh();
              }}
            >
              <Select required value={joinTeam} onChange={(e) => setJoinTeam(e.target.value)} aria-label="Team">
                <option value="">Choose a team…</option>
                {otherTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
              <Select value={joinType} onChange={(e) => setJoinType(e.target.value)} aria-label="As">
                <option value="member">Member</option>
                <option value="captain">Captain</option>
                <option value="mentor">Mentor</option>
              </Select>
              <Textarea rows={2} placeholder="Note for the approver (optional)" value={joinNote} onChange={(e) => setJoinNote(e.target.value)} maxLength={300} />
              <Button type="submit" size="sm" disabled={!joinTeam}>
                Request to join
              </Button>
            </form>
          </Card>
        )}

        <Card>
          <CardHeader title="Your data" />
          <div className="space-y-3 px-4 pb-4 text-[13px] text-muted">
            <p>Download a copy of your profile and the things you’ve written, or ask for your account to be deleted.</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                icon={<Download className="size-4" />}
                onClick={async () => {
                  const [profile, memberships, holders, comments, notifications] = await Promise.all([
                    sb.from('profiles').select('*').eq('id', me.id).single(),
                    sb.from('memberships').select('*').eq('user_id', me.id),
                    sb.from('position_holders').select('*').eq('user_id', me.id),
                    sb.from('comments').select('*').eq('author', me.id),
                    sb.from('notifications').select('*'),
                  ]);
                  downloadText(
                    JSON.stringify(
                      { exported_at: new Date().toISOString(), profile: profile.data, private: priv.data, memberships: memberships.data, positions: holders.data, comments: comments.data, notifications: notifications.data },
                      null,
                      2,
                    ),
                    'my-teamhub-data.json',
                    'application/json',
                  );
                }}
              >
                Download my data
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (!(await confirm({ title: 'Ask to delete your account?', body: 'Mentors and admins are notified. When they delete it, your name becomes “Former member” on things you contributed.', confirmLabel: 'Send request', danger: true }))) return;
                  const { error } = await sb.rpc('people_request_deletion');
                  if (error) return toast.error(friendlyError(error));
                  toast.success('Request sent to your mentors');
                }}
              >
                Request account deletion
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
