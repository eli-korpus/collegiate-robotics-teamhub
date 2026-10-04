import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, KeyRound, XCircle } from 'lucide-react';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { Banner, Button, Checkbox, Field, Input, Select, Spinner, toast } from '@teamhub/ui';
import { TOOL_SLOT_LABELS } from '@teamhub/sdk';
import { api } from '../api';
import { Section, StepShell, Why } from '../components';
import { useDraft } from '../draft';
import type { StepProps } from './basics';

const HINTS: Record<string, string> = {
  team_chat: 'Google Chat, Discord, Slack, GroupMe, Remind… TeamHub has no chat on purpose; this link is shown wherever people might want to talk.',
  portfolio: 'Your engineering portfolio (Google Doc / Slides).',
  code_repo: 'Your robot code on GitHub.',
  cad: 'Your Onshape document or workspace.',
  drive: 'Shared Google Drive / OneDrive folder: big files go here, not in TeamHub.',
  manual: 'Paste this season’s competition manual URL.',
};
const PREFILL: Record<string, { label: string; url: string }> = {
  gm0: { label: 'Game Manual 0', url: 'https://gm0.org' },
  ftc_docs: { label: 'FTC Docs', url: 'https://ftc-docs.firstinspires.org' },
};
const ORDER = ['team_chat', 'portfolio', 'code_repo', 'cad', 'drive', 'website', 'social', 'manual', 'qa_forum', 'ftcscout', 'gm0', 'ftc_docs'];

export function ToolLinksStep({ onNext, onBack }: StepProps) {
  const { draft, update } = useDraft();
  const c = draft.config;
  useEffect(() => {
    update((x) => {
      for (const [slot, v] of Object.entries(PREFILL)) if (!x.toolLinks.some((l) => l.slot === slot)) x.toolLinks.push({ slot, ...v, section: null, description: null });
      const n = x.teams[0]?.number;
      if (n && !x.toolLinks.some((l) => l.slot === 'ftcscout')) x.toolLinks.push({ slot: 'ftcscout', label: 'FTCScout', url: `https://ftcscout.org/teams/${n}`, section: null, description: null });
    });
     
  }, []);
  const get = (slot: string) => c.toolLinks.find((l) => l.slot === slot);
  const set = (slot: string, url: string, label?: string) =>
    update((x) => {
      const i = x.toolLinks.findIndex((l) => l.slot === slot);
      if (!url.trim()) {
        if (i >= 0) x.toolLinks.splice(i, 1);
        return;
      }
      const l = { slot, url: url.trim(), label: label ?? x.toolLinks[i]?.label ?? TOOL_SLOT_LABELS[slot], section: null, description: null };
      if (i >= 0) x.toolLinks[i] = l;
      else x.toolLinks.push(l);
    });
  const invalid = c.toolLinks.some((l) => !/^https?:\/\/\S+$/.test(l.url));
  return (
    <StepShell title="Your team's tools" subtitle="Links to the tools you already use. They appear as quick-link chips in the tabs where they're useful. All optional, all editable later in the dashboard." onBack={onBack} onNext={onNext} nextDisabled={invalid}>
      {ORDER.map((slot) => {
        const l = get(slot);
        return (
          <div key={slot} className="grid items-start gap-2 sm:grid-cols-[180px_1fr_160px]">
            <div className="pt-2 text-[13.5px] font-medium">{TOOL_SLOT_LABELS[slot]}</div>
            <div>
              <Input type="url" placeholder="https://" value={l?.url ?? ''} onChange={(e) => set(slot, e.target.value)} aria-label={`${TOOL_SLOT_LABELS[slot]} URL`} />
              {HINTS[slot] && <p className="mt-1 text-[12px] text-muted">{HINTS[slot]}</p>}
            </div>
            <Input placeholder="Label" value={l?.label ?? ''} disabled={!l} onChange={(e) => l && set(slot, l.url, e.target.value)} aria-label={`${TOOL_SLOT_LABELS[slot]} label`} />
          </div>
        );
      })}
      {invalid && <p className="text-[12.5px] text-danger">Links must start with https://</p>}
    </StepShell>
  );
}

interface ProjectRow {
  ref: string;
  name: string;
  region: string;
  status: string;
}

export function ConnectSupabase({ onNext, onBack }: StepProps) {
  const { draft, update, setDraft, server, refreshServer } = useDraft();
  const c = draft.config;
  const [pat, setPat] = useState('');
  const [remember, setRemember] = useState(true);
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<{ lines: string[]; sql: string; fresh: boolean } | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [log, setLog] = useState<{ step: string; ok: boolean; detail?: string }[] | null>(null);
  const [existing, setExisting] = useState(false);
  const [dataApi, setDataApi] = useState<{ schemas: string[]; ok: boolean } | null>(null);

  useEffect(() => {
    if (server.supabase.connected && !projects) api<{ projects: ProjectRow[] }>('/supabase/projects').then((r) => setProjects(r.projects)).catch(() => {});
  }, [server.supabase.connected, projects]);
  useEffect(() => {
    if (c.supabase.projectRef) api('/plan', c).then(setPlan).catch((e) => toast.error(e.message));
     
  }, [c.supabase.projectRef]);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await api<{ projects: ProjectRow[] }>('/supabase/token', { pat, remember });
      setProjects(r.projects);
      await refreshServer();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const select = async (ref: string) => {
    setBusy(true);
    try {
      const r = await api<{ url: string; anonKey: string; projectRef: string; existingInstall: boolean; dataApi: { schemas: string[]; ok: boolean } | null }>('/supabase/select', { ref, remember });
      setExisting(r.existingInstall);
      setDataApi(r.dataApi);
      update((x) => void (x.supabase = { url: r.url, anonKey: r.anonKey, projectRef: r.projectRef }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const apply = async () => {
    setBusy(true);
    setLog(null);
    try {
      await api('/config', c);
      const r = await api<{ log: { step: string; ok: boolean; detail?: string }[] }>('/apply', { config: c });
      setLog(r.log);
      setDraft((d) => ({ ...d, done: { ...d.done, applied: true } }));
      toast.success('Your database is ready');
    } catch (e) {
      setLog([{ step: 'Apply failed. Nothing was changed (the whole update runs in one transaction).', ok: false, detail: (e as Error).message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell title="Connect Supabase" subtitle="Supabase is your team's database, logins and file storage: on your own free account." onBack={onBack} onNext={onNext} nextDisabled={!draft.done.applied} nextLabel="Continue">
      <Section title="1. Create a free Supabase project" description="Skip this if you already made one for TeamHub.">
        <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-muted">
          <li>
            Go to{' '}
            <a className="font-medium text-accent hover:underline" href="https://supabase.com/dashboard/new" target="_blank" rel="noreferrer">
              supabase.com/dashboard/new <ExternalLink className="inline size-3" />
            </a>{' '}
            (sign up with GitHub if you don’t have an account).
          </li>
          <li>
            <strong>Organization</strong>: use your own (or create one). The free plan includes two free projects, so give TeamHub its own.
          </li>
          <li>
            <strong>Project name</strong>: your program’s name. <strong>Database password</strong>: click Generate and save it in a password manager (TeamHub
            never needs it). <strong>Region</strong>: the one closest to your team.
          </li>
          <li>
            <strong>Compute size</strong> (if shown): the free one (Nano) is plenty.
          </li>
          <li>
            Under <strong>Security</strong>:
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>
                <strong>Enable Data API</strong>: <strong>on</strong> (required, the website talks to your database through it), and keep it on the{' '}
                <strong>public</strong> schema. Don’t switch it to a separate “api” schema.
              </li>
              <li>
                <strong>Automatically expose new tables and functions</strong>: <strong>off</strong> is recommended. TeamHub gives its tables exactly the access they
                need either way.
              </li>
              <li>
                <strong>Enable automatic RLS</strong>: <strong>on</strong>. TeamHub turns on row-level security for every table anyway; this is an extra safety net.
              </li>
            </ul>
          </li>
          <li>
            Under <strong>Advanced configuration</strong> (if shown): keep <strong>Postgres type</strong> on regular <strong>Postgres</strong>, not OrioleDB (a beta storage
            engine TeamHub isn’t tested with). Leave everything else as it is.
          </li>
          <li>Click Create, then wait a minute or two until the project says it is ready.</li>
        </ol>
        <Why title="Already created the project with different choices?">
          <p>
            The only thing that matters is the Data API serving the <strong>public</strong> schema. After you pick your project below, the wizard checks this and can fix it
            for you. After setting up the database it also tests that your website will be able to reach it.
          </p>
          <p>The other choices (automatic exposure, automatic RLS, region, compute) don’t change how TeamHub works.</p>
        </Why>
      </Section>
      <Section title="2. Let this wizard talk to Supabase" description="A personal access token lets the wizard set up your database. It stays on this computer.">
        {server.supabase.connected ? (
          <p className="flex items-center gap-2 text-[13.5px]">
            <CheckCircle2 className="size-4 text-success" /> Connected{server.supabase.remembered ? ' (remembered on this computer)' : ''}.{' '}
            <button
              className="text-accent hover:underline"
              onClick={async () => {
                await api('/supabase/forget', {});
                setProjects(null);
                await refreshServer();
              }}
            >
              Disconnect
            </button>
          </p>
        ) : (
          <>
            <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-muted">
              <li>
                Open{' '}
                <a className="font-medium text-accent hover:underline" href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noreferrer">
                  Account &gt; Access Tokens <ExternalLink className="inline size-3" />
                </a>
                .
              </li>
              <li>Click “Generate new token”, name it “TeamHub wizard”, and copy it (it starts with sbp_).</li>
            </ol>
            <div className="flex gap-2">
              <Input type="password" value={pat} onChange={(e) => setPat(e.target.value)} placeholder="sbp_…" aria-label="Access token" />
              <Button variant="primary" icon={<KeyRound className="size-4" />} onClick={connect} loading={busy} disabled={!pat}>
                Connect
              </Button>
            </div>
            <Checkbox checked={remember} onChange={setRemember} label="Remember on this computer (saved in ~/.teamhub, never in your repository)" />
          </>
        )}
        {projects && (
          <Field label="Your project">
            {(id) => (
              <Select id={id} value={c.supabase.projectRef ?? ''} onChange={(e) => e.target.value && select(e.target.value)} disabled={busy}>
                <option value="">Choose a project…</option>
                {projects.map((p) => (
                  <option key={p.ref} value={p.ref}>
                    {p.name} ({p.region}){p.status !== 'ACTIVE_HEALTHY' ? ` (${p.status.toLowerCase()})` : ''}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {dataApi && !dataApi.ok && (
          <Banner tone="danger" title={dataApi.schemas.length ? 'The Data API isn’t serving the "public" schema' : 'The Data API is turned off'}>
            <p>
              TeamHub’s website talks to your database through Supabase’s Data API, using the <code>public</code> schema.
              {dataApi.schemas.length ? ` Right now it only serves: ${dataApi.schemas.join(', ')}.` : ''} The wizard can fix this for you.
            </p>
            <Button
              size="sm"
              className="mt-2"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await api<{ schemas: string[]; ok: boolean }>('/supabase/data-api/fix', {});
                  setDataApi(r);
                  if (r.ok) toast.success('Data API now serves the public schema');
                  else toast.error('Supabase didn’t accept the change. Turn on the Data API in Project Settings > Data API, then pick the project again.');
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Fix it for me
            </Button>
          </Banner>
        )}
        {existing && draft.flow === 'setup' && (
          <Banner tone="warning" title="This project already has TeamHub">
            Continuing updates it to match these settings. Existing data is kept. If you meant to start fresh, pick or create another project.
          </Banner>
        )}
        <Why>
          <p>The wizard uses the token to create tables and access rules, deploy three tiny server functions (password reset links, account deletion, file cleanup) and set sign-in options. It never sends the token anywhere else.</p>
          <p>Students can sign up without email confirmation because a captain or mentor approves every new account: Supabase’s built-in email only reaches your own Supabase team members.</p>
        </Why>
      </Section>
      {c.supabase.projectRef && (
        <Section title="3. Build your database" description="Review what will be created, then apply it. It runs as one transaction. If anything fails, nothing changes.">
          {!plan ? (
            <Spinner />
          ) : (
            <>
              <ul className="list-disc space-y-0.5 pl-5 text-[13.5px]">
                {plan.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
                <li>Deploy server functions and configure sign-in</li>
              </ul>
              <button className="text-[12.5px] text-accent hover:underline" onClick={() => setShowSql(!showSql)}>
                {showSql ? 'Hide' : 'Show'} the SQL
              </button>
              {showSql && <pre className="max-h-72 overflow-auto rounded-md bg-bg-subtle p-3 text-[11px] leading-relaxed">{plan.sql}</pre>}
              <Button variant="primary" onClick={apply} loading={busy}>
                {draft.done.applied ? 'Apply again' : 'Build my database'}
              </Button>
            </>
          )}
          {log && <ApplyLog log={log} />}
        </Section>
      )}
    </StepShell>
  );
}

export function ApplyLog({ log }: { log: { step: string; ok: boolean; detail?: string }[] }) {
  return (
    <ul className="space-y-1 rounded-md border border-border p-3 text-[13px]">
      {log.map((l, i) => (
        <li key={i} className="flex items-start gap-2">
          {l.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
          <span>
            {l.step}
            {l.detail && <span className="block break-all text-[12px] text-muted">{l.detail}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AdminAccount({ onNext, onBack }: StepProps) {
  const { draft, setDraft } = useDraft();
  const c: TeamhubConfig = draft.config;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [types, setTypes] = useState<Record<string, 'member' | 'captain' | 'mentor'>>(Object.fromEntries(c.teams.map((t) => [t.id, 'mentor'])));
  const [busy, setBusy] = useState(false);
  return (
    <StepShell
      title="Create your admin account"
      subtitle="This is you. Admins can do everything, including approving people and making others admins."
      onBack={onBack}
      onNext={onNext}
      nextDisabled={!draft.done.admin}
      footerExtra={
        draft.done.admin ? (
          <span className="flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle2 className="size-4" /> Admin created
          </span>
        ) : undefined
      }
    >
      <Field label="Your name">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}</Field>
        <Field label="Password" hint="At least 8 characters">
          {(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />}
        </Field>
      </div>
      <Section title="On each team you are a…" description="Used for display and things like attendance. As an admin you have every permission regardless.">
        {c.teams.map((t) => (
          <label key={t.id} className="flex items-center justify-between gap-3 text-[13.5px]">
            <span>{t.name || `Team ${t.shortCode}`}</span>
            <Select value={types[t.id]} onChange={(e) => setTypes({ ...types, [t.id]: e.target.value as 'mentor' })} className="w-40">
              <option value="mentor">Mentor</option>
              <option value="captain">Captain</option>
              <option value="member">Member</option>
            </Select>
          </label>
        ))}
      </Section>
      <Button
        variant="primary"
        loading={busy}
        disabled={!name.trim() || !/\S+@\S+/.test(email) || password.length < 8}
        onClick={async () => {
          setBusy(true);
          try {
            await api('/admin', { name: name.trim(), email: email.trim(), password, types });
            setDraft((d) => ({ ...d, done: { ...d.done, admin: true } }));
            toast.success('Admin account created. You can sign in with it once your site is live.');
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Create admin account
      </Button>
    </StepShell>
  );
}
