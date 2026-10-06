import { useEffect, useState } from 'react';
import { Archive, CalendarRange, CheckCircle2, DatabaseZap, Download, ExternalLink, Mail, Pencil, ShieldAlert, Upload, KeyRound } from 'lucide-react';
import { TEAMHUB_UPSTREAM_REPO } from '@teamhub/config-schema/util';
import { Banner, Button, Card, Checkbox, Dialog, Field, Input, Select, Spinner, Switch, toast } from '@teamhub/ui';
import { api, type Catalog, type ServerState } from '../api';
import { ModuleIcon } from '../components';
import { UpdateDialog } from './Update';
import { ActionButton, Checklist, NextStep, useAction } from '../progress';
import { PublishButton, WaitingToPublish } from '../steps/publish';

/** Existing install: Edit, Update, Backup & Export, Import, New Season, Email, Danger zone (spec §5.1). */
export function ExistingHome({ server, catalog, onEdit, refresh }: { server: ServerState; catalog: Catalog; onEdit: () => void; refresh: () => Promise<void> }) {
  const c = server.config!;
  const [dialog, setDialog] = useState<null | 'update' | 'backup' | 'import' | 'season' | 'email' | 'danger' | 'connect'>(null);
  const [resume, setResume] = useState(false);
  const [latest, setLatest] = useState<{ current: string; latest: string | null; available: boolean } | null>(null);
  useEffect(() => {
    // An update that was mid-way when the wizard restarted (or the page reloaded): finish it.
    api<{ stage: string } | null>('/update/state')
      .then((st) => {
        if (st?.stage === 'merged') {
          setResume(true);
          setDialog('update');
        }
      })
      .catch(() => {});
    api<{ current: string; latest: string | null; available: boolean }>('/update/check').then(setLatest).catch(() => {});
  }, []);
  const tabs = catalog.modules.filter((m) => m.id in c.modules);
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <p className="text-[13px] font-medium text-muted">TeamHub setup</p>
      <h1 className="text-[26px] font-semibold tracking-tight">{c.program.name}</h1>
      <p className="mt-1 text-[13.5px] text-muted">
        {c.teams.map((t) => t.name).join(' · ')} · Season {c.season}
        {c.hosting.url && (
          <>
            {' · '}
            <a href={c.hosting.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {c.hosting.url.replace(/^https:\/\//, '')}
            </a>
          </>
        )}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {tabs.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px]">
            <ModuleIcon name={m.icon} className="size-3.5 text-muted" /> {m.name}
            {c.modules[m.id].state === 'dormant' && <span className="text-faint">(dormant)</span>}
          </span>
        ))}
      </div>
      {!server.supabase.connected && (
        <Banner tone="info" className="mt-6" title="Connect Supabase to make changes" action={<Button size="sm" onClick={() => setDialog('connect')}>Connect</Button>}>
          Editing, updating and backups need your Supabase access token for this session.
        </Banner>
      )}
      <WaitingToPublish className="mt-6" recheck={dialog} />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Tile icon={<Pencil />} title="Edit" body="Add or remove tabs, rebrand, change positions or permissions." onClick={onEdit} primary />
        <Tile
          icon={<DatabaseZap />}
          title={latest?.available ? `Update to ${latest.latest}` : 'Update'}
          body={latest ? (latest.available ? `A new TeamHub version is out (you have ${latest.current}).` : `You’re on the newest version (${latest.current}).`) : 'Get the newest TeamHub and update your database.'}
          onClick={() => setDialog('update')}
          primary={!!latest?.available}
        />
        <Tile icon={<Download />} title="Backup & Export" body="Download all data and files as a zip." onClick={() => setDialog('backup')} />
        <Tile icon={<Upload />} title="Import" body="Restore a backup (e.g. into a new Supabase project)." onClick={() => setDialog('import')} />
        <Tile icon={<CalendarRange />} title="New Season" body="Set the new season label and roll over tabs." onClick={() => setDialog('season')} />
        <Tile icon={<Mail />} title="Email" body={c.features.email ? 'Email confirmation and “Forgot your password?” are on.' : 'Connect an email provider for confirmations and “Forgot your password?”.'} onClick={() => setDialog('email')} />
        <Tile icon={<ShieldAlert />} title="Danger zone" body="Remove TeamHub from the database." onClick={() => setDialog('danger')} danger />
      </div>
      {dialog === 'connect' && <ConnectDialog onClose={() => setDialog(null)} refresh={refresh} />}
      {dialog === 'update' && <UpdateDialog server={server} resume={resume} onClose={() => (setDialog(null), setResume(false))} />}
      {dialog === 'backup' && <BackupDialog server={server} onClose={() => setDialog(null)} />}
      {dialog === 'import' && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog === 'season' && <SeasonDialog server={server} catalog={catalog} onClose={() => setDialog(null)} refresh={refresh} />}
      {dialog === 'email' && <EmailDialog server={server} onClose={() => setDialog(null)} refresh={refresh} />}
      {dialog === 'danger' && <DangerDialog server={server} onClose={() => setDialog(null)} />}
    </div>
  );
}

function Tile({ icon, title, body, onClick, primary, danger }: { icon: React.ReactNode; title: string; body: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={`flex h-full gap-3 p-4 transition-shadow hover:shadow-md ${primary ? 'border-accent' : ''}`}>
        <span className={`grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-[18px] ${danger ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent'}`}>{icon}</span>
        <span>
          <span className="block font-semibold">{title}</span>
          <span className="block text-[12.5px] text-muted">{body}</span>
        </span>
      </Card>
    </button>
  );
}

function ConnectDialog({ onClose, refresh }: { onClose: () => void; refresh: () => Promise<void> }) {
  const [pat, setPat] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Connect Supabase" description="Paste a personal access token from supabase.com/dashboard/account/tokens. It stays on this computer.">
      <div className="space-y-3">
        <Input type="password" placeholder="sbp_…" value={pat} onChange={(e) => setPat(e.target.value)} />
        <Button
          variant="primary"
          icon={<KeyRound className="size-4" />}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api('/supabase/token', { pat, remember: true });
              await refresh();
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Connect
        </Button>
      </div>
    </Dialog>
  );
}

function BackupDialog({ server, onClose }: { server: ServerState; onClose: () => void }) {
  const action = useAction<{ path: string; tables: Record<string, number>; files: number }>();
  const res = action.result;
  return (
    <Dialog open onOpenChange={(v) => !v && action.state !== 'running' && onClose()} title="Backup & Export" description={`Saves all data and files as a zip in ${server.backupRoot}.`}>
      <div className="space-y-3 text-[13.5px]">
        <ActionButton state={action.state} label="Create backup" doneLabel="Backup saved" icon={<Archive className="size-4" />} onClick={() => action.run('/backup', {})} />
        <Checklist steps={action.steps} />
        {action.error && <Banner tone="danger" title="No backup was made">{action.error}</Banner>}
        {res && (
          <p className="text-[12.5px] text-muted">
            {Object.values(res.tables).reduce((a, b) => a + b, 0)} rows and {res.files} files, saved to <span className="break-all">{res.path}</span>
          </p>
        )}
        {res && <NextStep>keep the zip somewhere safe (for example a shared drive). Nothing else to do.</NextStep>}
        <p className="text-[12.5px] text-muted">Logins (passwords) can't be exported: after restoring into a new project, people sign up again and are re-approved; their history is kept.</p>
      </div>
    </Dialog>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState('');
  const action = useAction<{ restored: Record<string, number>; files: number }>();
  return (
    <Dialog open onOpenChange={(v) => !v && action.state !== 'running' && onClose()} title="Import a backup" description="Restores rows and files into the connected project. Existing rows are kept (duplicates are skipped). Apply your config first so all tables exist.">
      <div className="space-y-3">
        <Input placeholder="/Users/you/TeamHub Backups/2026-10-01/teamhub-backup-….zip" value={path} onChange={(e) => setPath(e.target.value)} aria-label="Backup file path" />
        <ActionButton state={action.state} label="Import" doneLabel="Backup restored" icon={<Upload className="size-4" />} disabled={!path.endsWith('.zip')} onClick={() => action.run('/import', { path })} />
        <Checklist steps={action.steps} />
        {action.error && <Banner tone="danger" title="Not restored">{action.error}</Banner>}
        {action.result && <NextStep>open your dashboard to check everything is back. People sign up again and are re-approved.</NextStep>}
      </div>
    </Dialog>
  );
}

function SeasonDialog({ server, catalog, onClose, refresh }: { server: ServerState; catalog: Catalog; onClose: () => void; refresh: () => Promise<void> }) {
  const c = server.config!;
  const y = Number(c.season.slice(0, 4)) + 1;
  const [label, setLabel] = useState(`${y}–${String((y + 1) % 100).padStart(2, '0')}`);
  const options = catalog.modules.filter((m) => m.id in c.modules);
  const [picked, setPicked] = useState<string[]>(options.map((m) => m.id));
  const action = useAction<{ backup: { path: string } }>();
  return (
    <Dialog open onOpenChange={(v) => !v && action.state !== 'running' && onClose()} title="New season" description="Exports everything first, then sets the new label and runs each tab's rollover (e.g. archive scouting, reset checklists, close polls)." size="lg">
      {(
        <div className="space-y-3 text-[13.5px]">
          <label className="flex items-center gap-2">
            New season label <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-32" />
          </label>
          <div className="flex flex-col gap-2">
            {options.map((m) => (
              <Checkbox key={m.id} checked={picked.includes(m.id)} onChange={(v) => setPicked(v ? [...picked, m.id] : picked.filter((x) => x !== m.id))} label={`Roll over ${m.name}`} />
            ))}
          </div>
          <ActionButton
            state={action.state}
            label={`Start ${label}`}
            doneLabel={`${label} started`}
            icon={<CalendarRange className="size-4" />}
            onClick={async () => {
              if (await action.run('/season', { label, modules: picked })) await refresh();
            }}
          />
          <Checklist steps={action.steps} />
          {action.error && <Banner tone="danger" title="The new season didn't start">{action.error}</Banner>}
          {action.state === 'done' && (
            <>
              <NextStep>publish, so your website shows {label}. To free storage from last season's files, use Admin &gt; Storage &gt; Delete old files afterwards.</NextStep>
              <PublishButton message={`Start the ${label} season`} label="Publish to your website" doneLabel="Published" next="nothing else. Your site shows the new season in a minute or two." />
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

interface Smtp {
  host: string;
  port: number;
  user: string;
  senderEmail: string;
  senderName: string;
}

/** Common free providers. Each needs its own account; docs/email.md walks through them. */
const SMTP_PRESETS: { id: string; label: string; host: string; port: number; user: string; userHint: string; passHint: string }[] = [
  { id: 'brevo', label: 'Brevo (free, no domain needed)', host: 'smtp-relay.brevo.com', port: 587, user: '', userHint: 'The SMTP login from Brevo > SMTP & API (it ends in @smtp-brevo.com).', passHint: 'An SMTP key from Brevo > SMTP & API.' },
  { id: 'gmail', label: 'Gmail or Google Workspace', host: 'smtp.gmail.com', port: 465, user: '', userHint: 'The full Gmail address.', passHint: 'A 16-letter app password (Google Account > Security > App passwords), not the normal password.' },
  { id: 'resend', label: 'Resend (needs your own domain)', host: 'smtp.resend.com', port: 465, user: 'resend', userHint: 'Always "resend".', passHint: 'A Resend API key (starts with re_).' },
  { id: 'other', label: 'Other (school or another provider)', host: '', port: 587, user: '', userHint: 'From your provider or school IT.', passHint: 'From your provider or school IT.' },
];

function EmailDialog({ server, onClose, refresh }: { server: ServerState; onClose: () => void; refresh: () => Promise<void> }) {
  const c = server.config!;
  const [on, setOn] = useState(c.features.email);
  const action = useAction<{ ok: boolean }>();
  const [smtp, setSmtp] = useState<Smtp | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preset, setPreset] = useState(SMTP_PRESETS[0]);
  const [form, setForm] = useState<Smtp & { pass: string }>({ host: SMTP_PRESETS[0].host, port: SMTP_PRESETS[0].port, user: '', pass: '', senderEmail: '', senderName: c.program.name });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    api<{ smtp: Smtp | null }>('/email')
      .then((r) => setSmtp(r.smtp))
      .catch((e) => setLoadError((e as Error).message));
  }, []);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const startEdit = () => {
    const match = SMTP_PRESETS.find((p) => p.host && p.host === smtp?.host) ?? SMTP_PRESETS[SMTP_PRESETS.length - 1];
    setPreset(match);
    if (smtp) setForm({ ...smtp, pass: '', senderName: smtp.senderName || c.program.name });
    setEditing(true);
  };
  const showForm = smtp === null || editing;
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title="Email"
      description="Lets TeamHub email people: a link to confirm their address when they join, and “Forgot your password?” on the sign-in page. Without it, mentors give out reset links from People."
    >
      <div className="space-y-5 text-[13.5px]">
        <section className="space-y-3">
          <h3 className="font-semibold">1. Email provider</h3>
          <p className="text-muted">
            Supabase’s built-in email only reaches your own Supabase account, so TeamHub sends through a free email service instead.{' '}
            <a href={`https://github.com/${TEAMHUB_UPSTREAM_REPO}/blob/main/docs/email.md`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Step-by-step guide <ExternalLink className="size-3.5" />
            </a>
          </p>
          {loadError && <Banner tone="danger" title="Couldn’t read your email settings">{loadError}</Banner>}
          {smtp === undefined && !loadError && <Spinner />}
          {smtp && !editing && (
            <div className="flex items-start gap-3 rounded-md border border-border p-3">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  Sending as {smtp.senderName || 'TeamHub'} &lt;{smtp.senderEmail}&gt;
                </p>
                <p className="truncate text-[12.5px] text-muted">
                  through {smtp.host}:{smtp.port}
                </p>
              </div>
              <Button size="sm" onClick={startEdit}>
                Change
              </Button>
            </div>
          )}
          {showForm && smtp !== undefined && (
            <div className="space-y-3">
              <Field label="Provider">
                {(id) => (
                  <Select
                    id={id}
                    value={preset.id}
                    onChange={(e) => {
                      const p = SMTP_PRESETS.find((x) => x.id === e.target.value)!;
                      setPreset(p);
                      set({ host: p.host, port: p.port, user: p.user });
                    }}
                  >
                    {SMTP_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                <Field label="Server (host)" required>
                  {(id) => <Input id={id} value={form.host} placeholder="smtp.example.org" onChange={(e) => set({ host: e.target.value })} />}
                </Field>
                <Field label="Port" required>
                  {(id) => <Input id={id} type="number" value={form.port || ''} onChange={(e) => set({ port: Number(e.target.value) })} />}
                </Field>
              </div>
              <Field label="Username" required hint={preset.userHint}>
                {(id) => <Input id={id} value={form.user} autoComplete="off" onChange={(e) => set({ user: e.target.value })} />}
              </Field>
              <Field label="Password or key" required={!smtp} hint={`${preset.passHint} It goes straight to Supabase and isn’t saved on this computer or in your repository.${smtp ? ' Leave blank to keep the saved one.' : ''}`}>
                {(id) => <Input id={id} type="password" value={form.pass} autoComplete="new-password" onChange={(e) => set({ pass: e.target.value })} />}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Send from (email)" required hint="Must be allowed by your provider (a verified sender).">
                  {(id) => <Input id={id} type="email" value={form.senderEmail} placeholder="robotics@yourschool.org" onChange={(e) => set({ senderEmail: e.target.value })} />}
                </Field>
                <Field label="Sender name" hint="What people see in their inbox.">
                  {(id) => <Input id={id} value={form.senderName} onChange={(e) => set({ senderName: e.target.value })} />}
                </Field>
              </div>
              {saveError && <Banner tone="danger" title="Not saved">{saveError}</Banner>}
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={async () => {
                    setSaving(true);
                    setSaveError(null);
                    try {
                      const r = await api<{ smtp: Smtp | null }>('/email/smtp', form);
                      setSmtp(r.smtp);
                      setEditing(false);
                      set({ pass: '' });
                      toast.success('Email provider saved in Supabase');
                    } catch (e) {
                      setSaveError((e as Error).message);
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Save provider
                </Button>
                {editing && <Button onClick={() => setEditing(false)}>Cancel</Button>}
              </div>
            </div>
          )}
        </section>
        <section className="space-y-3 border-t border-border pt-4">
          <h3 className="font-semibold">2. Turn it on</h3>
          <p className="text-muted">New people then confirm their email before they can sign in, and the sign-in page offers “Forgot your password?”.</p>
          <Switch checked={on} onChange={setOn} disabled={!smtp && !on} label="Email confirmation & self-serve password reset" description={!smtp && !on ? 'Save an email provider first.' : undefined} />
        <ActionButton
          state={action.state}
          label="Save"
          doneLabel="Saved"
          onClick={async () => {
            if (await action.run('/email', { on })) await refresh();
          }}
        />
        <Checklist steps={action.steps} />
        {action.error && <Banner tone="danger" title="Not saved">{action.error}</Banner>}
        {action.state === 'done' && (
          <>
            <NextStep>publish, so your login page matches.</NextStep>
            <PublishButton message={on ? 'Turn on email confirmation' : 'Turn off email confirmation'} label="Publish to your website" doneLabel="Published" next="nothing else. Your login page updates in a minute or two." />
          </>
        )}
        </section>
      </div>
    </Dialog>
  );
}

function DangerDialog({ server, onClose }: { server: ServerState; onClose: () => void }) {
  const t = server.config!.teams[0];
  const expected = String(t.number ?? t.shortCode);
  const [typed, setTyped] = useState('');
  const action = useAction<{ backup: { path: string } }>();
  return (
    <Dialog open onOpenChange={(v) => !v && action.state !== 'running' && onClose()} title="Remove TeamHub from the database" description="Deletes every TeamHub table, file, function and job from your Supabase project. A full backup is saved first. Logins are kept.">
      <div className="space-y-3 text-[13.5px]">
        <label className="block space-y-1.5">
          <span>
            Type <strong>{expected}</strong> to confirm
          </span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-40" />
        </label>
        {action.state === 'done' ? (
          <ActionButton state="done" label="" doneLabel="Removed" onClick={() => {}} />
        ) : (
          <Button variant="danger" disabled={typed !== expected} loading={action.state === 'running'} onClick={() => action.run('/danger/remove', { confirm: typed })}>
            Remove everything
          </Button>
        )}
        <Checklist steps={action.steps} />
        {action.error && <Banner tone="danger" title="Not removed">{action.error}</Banner>}
        {action.result && <p className="text-[12.5px] text-muted">Backup saved to <span className="break-all">{action.result.backup.path}</span></p>}
      </div>
    </Dialog>
  );
}
