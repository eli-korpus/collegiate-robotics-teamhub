import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Circle, Loader2, RotateCcw } from 'lucide-react';
import { TEAMHUB_UPSTREAM_REPO } from '@teamhub/config-schema/util';
import { Banner, Button, Checkbox, CopyBlock, Dialog, Markdown, Spinner, cn, toast } from '@teamhub/ui';
import { api, type ServerState } from '../api';
import { ApplyLog } from '../steps/connect';

interface Check {
  current: string;
  latest: string | null;
  available: boolean;
  major: boolean;
  notes: { version: string; date: string | null; body: string }[];
  customized: string[];
  customizationsNote: string | null;
  dirty: string[];
  last: UpdateState | null;
  error?: string;
}
interface UpdateState {
  stage: 'merged' | 'done' | 'rolled-back';
  from: string;
  to: string;
  backupPath: string | null;
}
type LogLine = { step: string; ok: boolean; detail?: string };

const STEPS = ['Back up your data', 'Get the new version', 'Install it', 'Restart the wizard', 'Update your database', 'Test build', 'Publish your site'] as const;

/** Wait until the wizard answers again after restarting itself. */
async function waitForWizard(): Promise<void> {
  await new Promise((r) => setTimeout(r, 1500));
  for (let i = 0; i < 120; i++) {
    try {
      await api('/state');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('The wizard didn’t come back after restarting. Run "npm run setup" again; it will finish the update.');
}

export function useUpdateCheck() {
  const [check, setCheck] = useState<Check | null>(null);
  const [loading, setLoading] = useState(true);
  const run = async () => {
    setLoading(true);
    try {
      setCheck(await api<Check>('/update/check'));
    } catch (e) {
      setCheck(null);
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    run();
  }, []);
  return { check, loading, recheck: run };
}

export function UpdateDialog({ server, onClose, resume }: { server: ServerState; onClose: () => void; resume?: boolean }) {
  const { check, loading, recheck } = useUpdateCheck();
  const [step, setStep] = useState<number>(-1);
  const [failed, setFailed] = useState<{ message: string; conflicts: string[] } | null>(null);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [readGuide, setReadGuide] = useState(false);
  const [rolling, setRolling] = useState(false);
  const resumed = useRef(false);

  const finish = async () => {
    setStep(4);
    try {
      const r = await api<{ ok: boolean; log: LogLine[]; version?: string }>('/update/finish', {});
      setLog(r.log);
      setStep(r.ok ? STEPS.length : -1);
      if (r.ok) toast.success(`Updated to TeamHub ${r.version}`);
    } catch (e) {
      setFailed({ message: (e as Error).message, conflicts: [] });
      setStep(-1);
    }
  };

  // The wizard restarts mid-update; when it comes back (or the page reloads), pick up where it left off.
  useEffect(() => {
    if (resume && !resumed.current) {
      resumed.current = true;
      void finish();
    }
  }, [resume]);

  const start = async () => {
    if (!check?.latest) return;
    setFailed(null);
    setLog(null);
    try {
      setStep(0);
      const res = await fetch('/api/update/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-teamhub-wizard': '1' },
        body: JSON.stringify({ tag: `v${check.latest}` }),
      });
      const r = (await res.json()) as { ok: boolean; message?: string; conflicts?: string[]; error?: string };
      if (!r.ok) {
        setFailed({ message: r.message ?? r.error ?? 'The update failed. Nothing was changed.', conflicts: r.conflicts ?? [] });
        setStep(-1);
        return;
      }
      setStep(3);
      await api('/restart', {});
      await waitForWizard();
      await finish();
    } catch (e) {
      setFailed({ message: (e as Error).message, conflicts: [] });
      setStep(-1);
    }
  };

  const undo = async () => {
    setRolling(true);
    try {
      const r = await api<{ ok: boolean; message: string }>('/update/rollback', {});
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
      await recheck();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRolling(false);
    }
  };

  const running = step >= 0 && step < STEPS.length;
  const done = step === STEPS.length;
  const security = check?.notes.some((n) => /^### Security\b/m.test(n.body));
  const majorGuide = check?.latest ? `https://github.com/${TEAMHUB_UPSTREAM_REPO}/blob/v${check.latest}/docs/upgrading/v${check.latest.split('.')[0]}.md` : '';
  const blocked = !server.supabase.connected || !!check?.dirty.length || (check?.major && !readGuide);

  return (
    <Dialog open onOpenChange={(v) => !v && !running && onClose()} title="Update TeamHub" description="Get the newest version of TeamHub and update your database and site." size="lg">
      <div className="space-y-4 text-[13.5px]">
        {loading && !resume ? (
          <p className="flex items-center gap-2 text-muted">
            <Spinner /> Checking for updates…
          </p>
        ) : running || done || resume ? (
          <Progress step={step} />
        ) : check?.error ? (
          <Banner tone="warning" title="Couldn’t check for updates">
            {check.error}
          </Banner>
        ) : check && !check.available ? (
          <Banner tone="success" title={`You’re on the newest version (${check.current})`}>
            Check again any time. GitHub can also tell you about new versions: see the Keep-alive step.
          </Banner>
        ) : check ? (
          <>
            <div>
              <p className="text-[16px] font-semibold">
                TeamHub {check.latest} is available <span className="font-normal text-muted">(you have {check.current})</span>
              </p>
            </div>
            {security && (
              <Banner tone="danger" title="Includes security fixes">
                Update as soon as you can.
              </Banner>
            )}
            {check.major && (
              <Banner tone="warning" title="This is a major update">
                <p>Major updates can change how things work. Read the upgrade guide before updating.</p>
                <a href={majorGuide} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
                  Open the upgrade guide
                </a>
                <Checkbox className="mt-2" checked={readGuide} onChange={setReadGuide} label="I read the upgrade guide" />
              </Banner>
            )}
            <section className="max-h-64 space-y-3 overflow-y-auto rounded-md border border-border p-3">
              {check.notes.length ? (
                check.notes.map((n) => (
                  <div key={n.version}>
                    <p className="font-semibold">
                      {n.version} {n.date && <span className="font-normal text-faint">· {n.date}</span>}
                    </p>
                    <Markdown source={n.body} className="text-[13px]" />
                  </div>
                ))
              ) : (
                <p className="text-muted">No release notes were found for this version.</p>
              )}
            </section>
            {check.customized.length > 0 && (
              <Banner tone="info" title={`Your team changed ${check.customized.length} TeamHub file${check.customized.length === 1 ? '' : 's'}`}>
                <p>The update keeps your changes. If it changes the same lines, it stops and explains, and nothing is changed.</p>
                <ul className="mt-1 max-h-24 list-disc overflow-y-auto pl-5 font-mono text-[12px]">
                  {check.customized.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {check.customizationsNote && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[12.5px] font-medium">Your notes (CUSTOMIZATIONS.md)</summary>
                    <Markdown source={check.customizationsNote} className="mt-1 text-[12.5px]" />
                  </details>
                )}
              </Banner>
            )}
            {check.dirty.length > 0 && (
              <Banner tone="warning" title="Save your changes first">
                These files have changes that aren’t committed yet: <span className="font-mono text-[12px]">{check.dirty.join(', ')}</span>. Commit them (or undo them),
                then check again.
              </Banner>
            )}
            {!server.supabase.connected && <Banner tone="warning">Connect Supabase first (it’s needed to back up and update your database).</Banner>}
            <div>
              <p className="mb-1 font-medium">What happens</p>
              <ol className="list-decimal space-y-0.5 pl-5 text-muted">
                {STEPS.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <p className="mt-1 text-[12.5px] text-faint">Your live site keeps running the old version until the last step, and you can undo the update afterwards.</p>
            </div>
            <Button variant="primary" icon={<ArrowRight className="size-4" />} disabled={blocked} onClick={start}>
              Update to {check.latest}
            </Button>
          </>
        ) : null}

        {failed && <Failure failed={failed} check={check} />}
        {log && <ApplyLog log={log} />}
        {done && <Banner tone="success" title="Update complete">Your host is rebuilding your site now. It’s usually live within a couple of minutes.</Banner>}

        {!running && check?.last?.stage === 'done' && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
            <span className="text-muted">
              Last update: {check.last.from} to {check.last.to}.
            </span>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} loading={rolling} onClick={undo}>
              Undo this update
            </Button>
            <span className="text-[12px] text-faint">Puts your site back on {check.last.from}. Your data stays.</span>
          </div>
        )}
        {!running && !done && <DatabaseOnly server={server} />}
      </div>
    </Dialog>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <ol className="space-y-1.5">
      {STEPS.map((s, i) => (
        <li key={s} className={cn('flex items-center gap-2', i > step && 'text-faint')}>
          {i < step || step === STEPS.length ? (
            <CheckCircle2 className="size-4 text-success" />
          ) : i === step ? (
            <Loader2 className="size-4 animate-spin text-accent" />
          ) : (
            <Circle className="size-4" />
          )}
          {s}
          {i === 3 && i === step && <span className="text-[12px] text-muted">(this page reconnects by itself)</span>}
        </li>
      ))}
    </ol>
  );
}

function Failure({ failed, check }: { failed: { message: string; conflicts: string[] }; check: Check | null }) {
  const prompt =
    check?.latest &&
    `We're updating our TeamHub FTC fork from version ${check.current} to ${check.latest}, and git reports conflicts in these files because our team changed them too:
${failed.conflicts.map((f) => `- ${f}`).join('\n')}

Please:
1. Read AGENTS.md, and CUSTOMIZATIONS.md if it exists, to understand the codebase and what we changed.
2. Run: git fetch teamhub-releases --tags && git merge v${check.latest}
3. Resolve each conflict so we keep our changes but also get everything new in ${check.latest}. Explain each decision.
4. Run npm install, npm run typecheck, npm run lint and npm test, and fix anything that fails.
5. Commit the merge, but don't push.

When you're done I'll run "npm run setup" and choose Update to finish (database and publishing).`;
  return (
    <div className="space-y-3">
      <Banner tone="danger" title={failed.conflicts.length ? 'The update was stopped: nothing was changed' : 'The update didn’t finish'}>
        <p className="whitespace-pre-wrap">{failed.message}</p>
        {failed.conflicts.length > 0 && (
          <ul className="mt-1 list-disc pl-5 font-mono text-[12px]">
            {failed.conflicts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
      </Banner>
      {failed.conflicts.length > 0 && prompt && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4 text-warning" /> How to fix it
          </p>
          <p className="text-muted">
            Your team’s changes and the new version touch the same lines. An AI coding assistant can combine them: paste this prompt into one (Claude Code, Cursor, GitHub
            Copilot…) opened in your TeamHub folder. Or undo your changes to those files and update again.
          </p>
          <CopyBlock text={prompt} label="Prompt" rows={10} />
        </div>
      )}
    </div>
  );
}

/** For copies already updated another way (GitHub "Sync fork" or a manual merge): just bring the database up to date. */
function DatabaseOnly({ server }: { server: ServerState }) {
  const [plan, setPlan] = useState<{ summary: { migrations: { id: string; from: number; to: number }[] } } | null>(null);
  const [log, setLog] = useState<LogLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <details className="rounded-md border border-border p-3">
      <summary className="cursor-pointer font-medium">Already updated the code another way?</summary>
      <div className="mt-2 space-y-2">
        <p className="text-muted">
          If you used GitHub’s Sync fork or merged the update yourself, bring your database up to date here. (Avoid Sync fork’s “Discard commits” button: it deletes your
          team’s settings.)
        </p>
        <Button
          size="sm"
          onClick={async () => {
            try {
              setPlan(await api('/plan', server.config));
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}
        >
          Check the database
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
                size="sm"
                variant="primary"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    setLog((await api<{ log: LogLine[] }>('/apply', { config: server.config })).log);
                  } catch (e) {
                    setLog([{ step: 'Update failed; nothing changed.', ok: false, detail: (e as Error).message }]);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Update the database
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-success">
              <CheckCircle2 className="size-4" /> Your database is up to date.
            </p>
          ))}
        {log && <ApplyLog log={log} />}
      </div>
    </details>
  );
}

