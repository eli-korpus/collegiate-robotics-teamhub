import { useState } from 'react';
import { Archive, CalendarRange, DatabaseZap, Download, Mail, Pencil, ShieldAlert, Upload, KeyRound } from 'lucide-react';
import { Banner, Button, Card, Checkbox, Dialog, Input, Switch, toast } from '@teamhub/ui';
import { api, type Catalog, type ServerState } from '../api';
import { ModuleIcon } from '../components';
import { ApplyLog } from '../steps/connect';

/** Existing install: Edit, Update, Backup & Export, Import, New Season, Email, Danger zone (spec §5.1). */
export function ExistingHome({ server, catalog, onEdit, refresh }: { server: ServerState; catalog: Catalog; onEdit: () => void; refresh: () => Promise<void> }) {
  const c = server.config!;
  const [dialog, setDialog] = useState<null | 'update' | 'backup' | 'import' | 'season' | 'email' | 'danger' | 'connect'>(null);
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
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Tile icon={<Pencil />} title="Edit" body="Add or remove tabs, rebrand, change positions or permissions." onClick={onEdit} primary />
        <Tile icon={<DatabaseZap />} title="Update" body="After “Sync fork” on GitHub: apply new database changes." onClick={() => setDialog('update')} />
        <Tile icon={<Download />} title="Backup & Export" body="Download all data and files as a zip." onClick={() => setDialog('backup')} />
        <Tile icon={<Upload />} title="Import" body="Restore a backup (e.g. into a new Supabase project)." onClick={() => setDialog('import')} />
        <Tile icon={<CalendarRange />} title="New Season" body="Set the new season label and roll over tabs." onClick={() => setDialog('season')} />
        <Tile icon={<Mail />} title="Email" body={c.features.email ? 'Self-serve password reset is on.' : 'Turn on email confirmations after adding SMTP.'} onClick={() => setDialog('email')} />
        <Tile icon={<ShieldAlert />} title="Danger zone" body="Remove TeamHub from the database." onClick={() => setDialog('danger')} danger />
      </div>
      {dialog === 'connect' && <ConnectDialog onClose={() => setDialog(null)} refresh={refresh} />}
      {dialog === 'update' && <UpdateDialog server={server} onClose={() => setDialog(null)} />}
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

function UpdateDialog({ server, onClose }: { server: ServerState; onClose: () => void }) {
  const [pull, setPull] = useState<{ ok: boolean; log: string } | null>(null);
  const [plan, setPlan] = useState<{ summary: { migrations: { id: string; from: number; to: number }[] }; lines: string[] } | null>(null);
  const [log, setLog] = useState<{ step: string; ok: boolean; detail?: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Update" description="Get the newest TeamHub and update your database." size="lg">
      <div className="space-y-4 text-[13.5px]">
        <ol className="list-decimal space-y-1 pl-5">
          <li>On GitHub, open your fork and click <strong>Sync fork &gt; Update branch</strong>.</li>
          <li>
            Pull it to this computer:{' '}
            <Button
              size="sm"
              onClick={async () => {
                setPull(await api('/git/pull', {}));
              }}
            >
              git pull
            </Button>
          </li>
          <li>If new code was pulled, stop the wizard (Ctrl+C), run <code>npm install</code> and <code>npm run setup</code> again, then come back here.</li>
        </ol>
        {pull && <pre className="max-h-32 overflow-auto rounded-md bg-bg-subtle p-2 text-[11.5px]">{pull.log}</pre>}
        <Button
          onClick={async () => {
            try {
              setPlan(await api('/plan', server.config));
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Check for database updates
        </Button>
        {plan &&
          (plan.summary.migrations.length ? (
            <>
              <ul className="list-disc pl-5">
                {plan.summary.migrations.map((m) => (
                  <li key={m.id}>
                    {m.id}: version {m.from} to {m.to}
                  </li>
                ))}
              </ul>
              <Button
                variant="primary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setLog((await api<{ log: typeof log }>('/apply', { config: server.config })).log);
                  } catch (e) {
                    setLog([{ step: 'Update failed; nothing changed.', ok: false, detail: (e as Error).message }]);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Apply updates
              </Button>
            </>
          ) : (
            <Banner tone="success">Your database is up to date.</Banner>
          ))}
        {log && <ApplyLog log={log} />}
      </div>
    </Dialog>
  );
}

function BackupDialog({ server, onClose }: { server: ServerState; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ path: string; tables: Record<string, number>; files: number } | null>(null);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Backup & Export" description={`Saves all data and files as a zip in ${server.backupRoot}.`}>
      <div className="space-y-3 text-[13.5px]">
        <Button
          variant="primary"
          icon={<Archive className="size-4" />}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await api('/backup', {}));
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Create backup
        </Button>
        {res && (
          <Banner tone="success" title="Backup saved">
            <span className="break-all">{res.path}</span>
            <br />
            {Object.values(res.tables).reduce((a, b) => a + b, 0)} rows, {res.files} files
          </Banner>
        )}
        <p className="text-[12.5px] text-muted">Logins (passwords) can't be exported — after restoring into a new project, people sign up again and are re-approved; their history is kept.</p>
      </div>
    </Dialog>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ restored: Record<string, number>; files: number } | null>(null);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Import a backup" description="Restores rows and files into the connected project. Existing rows are kept (duplicates are skipped). Apply your config first so all tables exist.">
      <div className="space-y-3">
        <Input placeholder="/Users/you/TeamHub Backups/2026-10-01/teamhub-backup-….zip" value={path} onChange={(e) => setPath(e.target.value)} aria-label="Backup file path" />
        <Button
          variant="primary"
          loading={busy}
          disabled={!path.endsWith('.zip')}
          onClick={async () => {
            setBusy(true);
            try {
              setRes(await api('/import', { path }));
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Import
        </Button>
        {res && (
          <Banner tone="success">
            Restored {Object.values(res.restored).reduce((a, b) => a + b, 0)} rows and {res.files} files.
          </Banner>
        )}
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
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="New season" description="Exports everything first, then sets the new label and runs each tab's rollover (e.g. archive scouting, reset checklists, close polls)." size="lg">
      {(
        <div className="space-y-3 text-[13.5px]">
          <label className="flex items-center gap-2">
            New season label <Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-32" />
          </label>
          <div className="space-y-1.5">
            {options.map((m) => (
              <Checkbox key={m.id} className="flex" checked={picked.includes(m.id)} onChange={(v) => setPicked(v ? [...picked, m.id] : picked.filter((x) => x !== m.id))} label={`Roll over ${m.name}`} />
            ))}
          </div>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const r = await api<{ backup: { path: string } }>('/season', { label, modules: picked });
                setDone(r.backup.path);
                await refresh();
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Start {label}
          </Button>
          {done && (
            <Banner tone="success" title={`Welcome to ${label}!`}>
              Backup: <span className="break-all">{done}</span>. To free storage from last season's files, use Admin &gt; Storage &gt; Delete old files in the dashboard.
            </Banner>
          )}
        </div>
      )}
    </Dialog>
  );
}

function EmailDialog({ server, onClose, refresh }: { server: ServerState; onClose: () => void; refresh: () => Promise<void> }) {
  const [on, setOn] = useState(server.config!.features.email);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Email" description="Supabase's built-in email only reaches your own Supabase team members, so TeamHub works without email by default.">
      <div className="space-y-4 text-[13.5px]">
        <ol className="list-decimal space-y-1 pl-5 text-muted">
          <li>In the Supabase dashboard &gt; Authentication &gt; Emails &gt; SMTP Settings, add an email provider (e.g. Resend, SendGrid, your school's SMTP).</li>
          <li>Turn this on. New signups then confirm their email, and the login page offers “Forgot your password?”.</li>
        </ol>
        <Switch checked={on} onChange={setOn} label="Email confirmation & self-serve password reset" />
        <Button
          variant="primary"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api('/email', { on });
              await refresh();
              toast.success('Saved — push your config (Edit > Review) so the login page updates.');
              onClose();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Save
        </Button>
      </div>
    </Dialog>
  );
}

function DangerDialog({ server, onClose }: { server: ServerState; onClose: () => void }) {
  const t = server.config!.teams[0];
  const expected = String(t.number ?? t.shortCode);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()} title="Remove TeamHub from the database" description="Deletes every TeamHub table, file, function and job from your Supabase project. A full backup is saved first. Logins are kept.">
      <div className="space-y-3 text-[13.5px]">
        <label className="block space-y-1.5">
          <span>
            Type <strong>{expected}</strong> to confirm
          </span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-40" />
        </label>
        <Button
          variant="danger"
          disabled={typed !== expected}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await api<{ backup: { path: string } }>('/danger/remove', { confirm: typed });
              setDone(r.backup.path);
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Remove everything
        </Button>
        {done && <Banner tone="success">Removed. Backup saved to {done}</Banner>}
      </div>
    </Dialog>
  );
}
