import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, GitBranch, PartyPopper, Printer, RefreshCw } from 'lucide-react';
import type { HostProvider } from '@teamhub/config-schema';
import { Banner, Button, Card, Checkbox, CopyBlock, Field, Input, QRCode, Spinner, cn, toast } from '@teamhub/ui';
import { agentPrompt } from '@teamhub/sdk/agent-prompt';
import { api, type GitState } from '../api';
import { Section, StepShell, Why } from '../components';
import { useDraft } from '../draft';
import type { StepProps } from './basics';

function useGit() {
  const [git, setGit] = useState<GitState | null>(null);
  const refresh = () => api<GitState>('/git').then(setGit);
  useEffect(() => {
    refresh();
  }, []);
  return { git, refresh };
}

export function PublishButton({ message, onDone, label = 'Commit & push to GitHub' }: { message: string; onDone?: () => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        icon={<GitBranch className="size-4" />}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api<{ ok: boolean; log: string }>('/git/publish', { message });
            setLog(r.log);
            if (r.ok) {
              toast.success('Pushed to GitHub');
              onDone?.();
            } else toast.error('Git push failed — see the details below.');
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {label}
      </Button>
      {log && <pre className="max-h-40 overflow-auto rounded-md bg-bg-subtle p-2 text-[11.5px]">{log}</pre>}
    </div>
  );
}

export function Publish({ onNext, onBack }: StepProps) {
  const { draft, setDraft } = useDraft();
  const { git, refresh } = useGit();
  const [forking, setForking] = useState(false);
  if (!git) return <Spinner className="m-10" />;
  return (
    <StepShell title="Save your settings to GitHub" subtitle="Your settings live in the team/ folder of your GitHub fork. Your website host rebuilds from it." onBack={onBack} onNext={onNext} nextDisabled={!draft.done.published} nextLabel="Continue">
      {!git.isRepo ? (
        <Banner tone="danger" title="This folder isn't a git repository">
          Fork TeamHub on GitHub, then clone your fork (GitHub Desktop: File &gt; Clone repository) and run <code>npm run setup</code> from there.
        </Banner>
      ) : (
        <>
          <Card className="space-y-1 p-4 text-[13.5px]">
            <p>
              Repository: <code>{git.remote ?? 'no remote'}</code>
            </p>
            <p>Branch: {git.branch}</p>
            {git.gh?.repo && <p>GitHub: {git.gh.repo} {git.gh.isFork ? <><Check className="inline size-3.5 text-success" aria-hidden /> your fork</> : git.gh.isFork === false ? '(not a fork)' : ''}</p>}
          </Card>
          {git.gh?.installed && git.gh.authed && git.gh.isFork === false && /teamhub-ftc/.test(git.remote ?? '') && (
            <Banner
              tone="warning"
              title="This looks like the original TeamHub repository, not your fork"
              action={
                <Button
                  size="sm"
                  loading={forking}
                  onClick={async () => {
                    setForking(true);
                    const r = await api<{ ok: boolean; log: string }>('/git/fork', {});
                    setForking(false);
                    if (!r.ok) toast.error(r.log);
                    refresh();
                  }}
                >
                  Fork it for me
                </Button>
              }
            >
              Pushing needs your own fork. The button uses the GitHub CLI to fork and point this folder at it.
            </Banner>
          )}
          {!git.userConfigured && (
            <Banner tone="warning" title="Git doesn't know who you are yet">
              Run <code>git config --global user.name "Your Name"</code> and <code>git config --global user.email you@example.com</code> in a terminal, then refresh.
            </Banner>
          )}
          <Section title="What gets committed" description="Only TeamHub's team folder and host settings, so TeamHub updates never conflict with them and you always get new tabs and fixes.">
            <ul className="list-disc pl-5 text-[13px] text-muted">
              <li>team/teamhub.config.json (no secrets — the Supabase URL and publishable key are public by design)</li>
              <li>team/branding/ (logos)</li>
            </ul>
          </Section>
          <PublishButton message="Set up TeamHub" onDone={() => setDraft((d) => ({ ...d, done: { ...d.done, published: true } }))} />
          <Button variant="ghost" size="sm" icon={<RefreshCw className="size-4" />} onClick={refresh}>
            Refresh status
          </Button>
          <Why title="Prefer GitHub Desktop?">
            <p>Open GitHub Desktop, select this repository, write a summary like “Set up TeamHub”, click Commit, then Push origin. Then click “I pushed it myself” below.</p>
            <Button size="sm" onClick={() => setDraft((d) => ({ ...d, done: { ...d.done, published: true } }))}>
              I pushed it myself
            </Button>
          </Why>
        </>
      )}
    </StepShell>
  );
}

const HOSTS: { id: HostProvider; name: string; blurb: string }[] = [
  { id: 'cloudflare', name: 'Cloudflare', blurb: 'Fast, generous free plan. Recommended.' },
  { id: 'vercel', name: 'Vercel', blurb: 'Very easy GitHub import.' },
  { id: 'netlify', name: 'Netlify', blurb: 'Easy GitHub import, simple dashboard.' },
  { id: 'github-pages', name: 'GitHub Pages', blurb: 'No extra account; builds with GitHub Actions.' },
];

const GUIDES: Record<HostProvider, string[]> = {
  cloudflare: [
    'Go to dash.cloudflare.com > Compute (Workers) > Create > Import a repository, and connect GitHub.',
    'Pick your TeamHub fork. Build command: npm run build. Deploy command: npx wrangler deploy (the wrangler.jsonc file we added tells it where the site is).',
    'Click Deploy. After a minute or two you get a URL like https://<name>.<account>.workers.dev — paste it below.',
  ],
  vercel: [
    'Go to vercel.com/new and import your TeamHub fork from GitHub.',
    'Leave Framework as “Other”. The vercel.json file we added sets the build command and output folder.',
    'Click Deploy, then copy the production URL (https://<name>.vercel.app) and paste it below.',
  ],
  netlify: [
    'Go to app.netlify.com > Add new site > Import an existing project > GitHub, and choose your fork.',
    'The netlify.toml we added sets everything; just click Deploy.',
    'Copy the site URL (https://<name>.netlify.app) and paste it below.',
  ],
  'github-pages': [
    'On GitHub open your fork > Settings > Pages. Under “Build and deployment”, set Source to “GitHub Actions”.',
    'The workflow we added (.github/workflows/pages.yml) builds and publishes on every push. Watch it under the Actions tab.',
    'Your URL is https://<your-username>.github.io/<repository-name>/ — paste it below.',
  ],
};

export function Host({ onNext, onBack }: StepProps) {
  const { draft, update, setDraft } = useDraft();
  const c = draft.config;
  const [provider, setProvider] = useState<HostProvider | null>(c.hosting.provider);
  const [filesWritten, setFilesWritten] = useState(false);
  const [url, setUrl] = useState(c.hosting.url ?? '');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const choose = async (p: HostProvider) => {
    setProvider(p);
    update((x) => void (x.hosting.provider = p));
    await api('/hosting/files', { provider: p, programName: c.program.name });
    setFilesWritten(true);
  };

  return (
    <StepShell title="Put it on the web" subtitle="Connect a free host to your GitHub fork. Every time settings are pushed, the site rebuilds automatically." onBack={onBack} onNext={onNext} nextDisabled={!draft.done.hosted} nextLabel="Continue">
      <div className="grid gap-2 sm:grid-cols-2">
        {HOSTS.map((h) => (
          <button key={h.id} type="button" onClick={() => choose(h.id)} aria-pressed={provider === h.id} className={cn('rounded-lg border bg-surface p-3 text-left shadow-sm', provider === h.id ? 'border-accent ring-1 ring-accent' : 'border-border')}>
            <p className="font-semibold">{h.name}</p>
            <p className="text-[12.5px] text-muted">{h.blurb}</p>
          </button>
        ))}
      </div>
      {provider && (
        <>
          <Section title="1. Push the host settings file" description="We added a small settings file for your host. Push it so the host can read it.">
            {filesWritten || c.hosting.provider === provider ? <PublishButton message={`Add ${provider} hosting settings`} label="Push host settings" /> : <Spinner />}
          </Section>
          <Section title="2. Connect the host to your fork">
            <ol className="list-decimal space-y-1.5 pl-5 text-[13.5px]">
              {GUIDES[provider].map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ol>
            <p className="text-[12.5px] text-muted">Detailed guide with troubleshooting: docs/hosting/{provider}.md in your repository.</p>
          </Section>
          <Section title="3. Paste your site's address">
            <div className="flex gap-2">
              <Input type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Site URL" />
              <Button
                variant="primary"
                loading={checking}
                disabled={!/^https:\/\//.test(url)}
                onClick={async () => {
                  setChecking(true);
                  try {
                    const clean = url.replace(/\/+$/, '/');
                    if (provider === 'github-pages') {
                      const path = new URL(clean).pathname;
                      if (path !== c.hosting.basePath) {
                        update((x) => void (x.hosting.basePath = path.endsWith('/') ? path : `${path}/`));
                        toast.info('Your site lives in a sub-folder — we updated the build. Push again after this step.');
                      }
                    }
                    await api('/config', { ...c, hosting: { ...c.hosting, provider, url: clean.replace(/\/$/, '') } });
                    await api('/auth/site-url', { url: clean.replace(/\/$/, '') });
                    update((x) => void (x.hosting.url = clean.replace(/\/$/, '')));
                    const r = await api<{ ok: boolean; message: string }>('/hosting/check', { url: clean });
                    setResult(r);
                    if (r.ok) setDraft((d) => ({ ...d, done: { ...d.done, hosted: true } }));
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                Check
              </Button>
            </div>
            {result && <Banner tone={result.ok ? 'success' : 'warning'}>{result.message}</Banner>}
            {result && !result.ok && (
              <Button size="sm" variant="ghost" onClick={() => setDraft((d) => ({ ...d, done: { ...d.done, hosted: true } }))}>
                Skip the check — I'll fix it later
              </Button>
            )}
            <Why title="What happens with the address?">
              <p>Supabase needs your site's address so password-reset links and sign-ins return to the right place. The wizard sets it for you.</p>
            </Why>
          </Section>
        </>
      )}
    </StepShell>
  );
}

export function KeepAlive({ onNext, onBack }: StepProps) {
  const { draft, setDraft } = useDraft();
  const [written, setWritten] = useState(false);
  const [updates, setUpdates] = useState(true);
  return (
    <StepShell title="Keep your database awake" subtitle="Free Supabase projects pause after 7 days without activity — for example over a long break." onBack={onBack} onNext={onNext} nextLabel={draft.done.keepalive ? 'Continue' : 'Skip for now'}>
      <Section title="A tiny scheduled ping" description="We add a GitHub Action to your fork that pings your database every 3 days. It needs no secrets — it reads the public address from your config.">
        {!written ? (
          <div className="space-y-3">
            <Checkbox
              checked={updates}
              onChange={setUpdates}
              label="Also check once a week for TeamHub updates"
            />
            <p className="-mt-2 pl-7 text-[12.5px] text-muted">Opens an issue in your fork (GitHub emails you) when a new version is out. It never changes your code.</p>
            <Button
              variant="primary"
              onClick={async () => {
                await api('/keepalive', { updates });
                setWritten(true);
              }}
            >
              Add the workflow{updates ? 's' : ''}
            </Button>
          </div>
        ) : (
          <PublishButton message="Add TeamHub keep-alive and update-check workflows" label="Push it" onDone={() => setDraft((d) => ({ ...d, done: { ...d.done, keepalive: true } }))} />
        )}
        {draft.done.keepalive && (
          <p className="flex items-center gap-1.5 text-[13px] text-success">
            <CheckCircle2 className="size-4" /> Installed. Admins see “last keep-alive ping” in Admin &gt; Keep-alive.
          </p>
        )}
      </Section>
      <Banner tone="info" title="One thing to know">
        GitHub turns off scheduled workflows in repositories with no commits for 60 days. If that happens, open your fork &gt; Actions &gt; “Keep TeamHub awake” &gt; Enable workflow. If the project
        does pause, open it in the Supabase dashboard and click Restore — your data is kept.
      </Banner>
    </StepShell>
  );
}

export function Done() {
  const { draft, reset, catalog } = useDraft();
  const c = draft.config;
  const site = c.hosting.url;
  const join = site ? `${site}/join` : null;
  const invite = `Join ${c.program.name} on TeamHub: ${join ?? '(your site)/join'} — sign up with your name, email and a password, pick your team, and a captain or mentor will approve you.`;
  return (
    <StepShell title="You're all set!" subtitle="Your dashboard is live. Here's how to bring your team in.">
      <Card className="flex items-start gap-3 p-4">
        <PartyPopper className="mt-0.5 size-6 shrink-0 text-accent" />
        <div className="space-y-1 text-[13.5px]">
          {site ? (
            <a href={site} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-accent hover:underline">
              {site} <ExternalLink className="size-4" />
            </a>
          ) : (
            <p>Your site will be live once your host finishes deploying.</p>
          )}
          <p className="text-muted">Sign in with your admin account, then approve people as they join (People &gt; Requests).</p>
        </div>
      </Card>
      <Section title="Invite your team">
        <Field label="Message to share">{(id) => <textarea id={id} readOnly value={invite} rows={3} className="w-full rounded-md border border-border bg-surface p-2 text-[13px]" />}</Field>
        <Button
          icon={<Copy className="size-4" />}
          onClick={async () => {
            await navigator.clipboard.writeText(invite);
            toast.success('Copied');
          }}
        >
          Copy invite
        </Button>
        {join && (
          <div className="flex items-center gap-4">
            <QRCode value={join} size={120} />
            <a href={`${site}/help/join`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-accent hover:underline">
              <Printer className="size-4" /> Printable “How to join” page with this QR code
            </a>
          </div>
        )}
      </Section>
      <Section
        title="Customize it with an AI assistant"
        description="For changes the wizard can't make (wording, layouts, new fields), paste this into an AI coding assistant like Claude Code, Cursor or GitHub Copilot, opened in your copy of TeamHub. It points the assistant to AGENTS.md, a guide to the code and its safety rules. You can find this prompt later in your dashboard under Admin > AI assistant."
      >
        <CopyBlock
          label="Prompt"
          rows={12}
          text={agentPrompt({ programName: c.program.name, tabs: catalog.modules.filter((m) => m.id in c.modules && c.modules[m.id].state === 'active').map((m) => m.name) })}
        />
      </Section>
      <Section title="Later">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted">
          <li>
            Run <code>npm run setup</code> again any time to add or remove tabs, rebrand, or change permissions (Edit mode).
          </li>
          <li>When TeamHub releases an update, admins see a notice in the dashboard. Run setup &gt; Update: it updates your database, then your site, and you can undo it.</li>
        </ul>
      </Section>
      <Button
        onClick={async () => {
          await api('/draft', undefined, 'DELETE');
          reset(null);
        }}
      >
        Finish
      </Button>
    </StepShell>
  );
}
