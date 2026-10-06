import { useEffect, useState } from 'react';
import { Archive, Database, GitBranch, Hammer, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { Banner, Button, Input, Segmented, Spinner, toast } from '@teamhub/ui';
import { api } from '../api';
import { Section, StepShell } from '../components';
import { useDraft } from '../draft';
import { ActionButton, Checklist, NextStep, useAction } from '../progress';
import { PublishButton, WaitingToPublish } from './publish';
import type { StepProps } from './basics';

interface DiffLine {
  kind: '+' | '-' | '~';
  text: string;
  detail?: string;
  removedModule?: string;
}

/** Edit mode: diff summary → per-removed-tab choice → backup + transactional apply → local build → push (spec §5.3, §5.6). */
export function Review({ onBack }: StepProps) {
  const { draft, setDraft, server } = useDraft();
  const [lines, setLines] = useState<DiffLine[] | null>(null);
  const [typed, setTyped] = useState('');
  const applyAction = useAction<{ log: { step: string; ok: boolean; detail?: string }[] }>();
  const buildAction = useAction<{ ok: boolean; log: string }>();
  const [published, setPublished] = useState(false);
  const [showBuildLog, setShowBuildLog] = useState(false);
  const confirmText = String(draft.config.teams[0]?.number ?? draft.config.teams[0]?.shortCode ?? '');

  useEffect(() => {
    api<{ lines: DiffLine[] }>('/diff', draft.config).then((r) => setLines(r.lines)).catch((e) => toast.error(e.message));
  }, [draft.config]);

  const removed = (lines ?? []).filter((l) => l.removedModule).map((l) => l.removedModule!);
  const choice = (id: string) => draft.removals[id] ?? 'dormant';
  const deleting = removed.filter((id) => choice(id) === 'delete');

  const finalConfig = (): TeamhubConfig => {
    const c = structuredClone(draft.config);
    const prev = server.config!;
    for (const id of removed) if (choice(id) === 'dormant') c.modules[id] = { ...prev.modules[id], state: 'dormant' };
    return c;
  };

  const build = () => buildAction.run('/build', {}, (r) => r.ok);

  const apply = async () => {
    buildAction.reset();
    setPublished(false);
    const cfg = finalConfig();
    const dormantNow = Object.entries(cfg.modules).filter(([id, m]) => m.state === 'dormant' && server.config!.modules[id]?.state !== 'dormant').map(([id]) => id);
    const r = await applyAction.run('/apply', { config: cfg, backupModules: [...removed, ...dormantNow.filter((d) => !removed.includes(d))] }, (x) => x.log.every((l) => l.ok));
    if (!r) return;
    setDraft((d) => ({ ...d, done: { ...d.done, applied: true } }));
    // Straight on to the test build, so Commit & push is ready without another click to find.
    if (r.log.every((l) => l.ok)) await build();
  };

  return (
    <StepShell title="Review & apply" subtitle="Here's everything that will change. Removing a tab always exports its data first." onBack={onBack}>
      {!lines?.length && <WaitingToPublish recheck={draft.done.published} />}
      {!lines ? (
        <Spinner />
      ) : !lines.length ? (
        <Banner tone="info">No changes yet. Use the steps on the left to edit your dashboard.</Banner>
      ) : (
        <Section title="Changes to apply">
          <ul className="space-y-1.5 font-mono text-[12.5px]">
            {lines.map((l, i) => (
              <li key={i} className="flex items-start gap-2">
                {l.kind === '+' ? <Plus className="mt-0.5 size-3.5 text-success" /> : l.kind === '-' ? <Minus className="mt-0.5 size-3.5 text-danger" /> : <Pencil className="mt-0.5 size-3.5 text-muted" />}
                <span>
                  {l.text} {l.detail && <span className="text-muted">({l.detail})</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {removed.map((id) => (
        <Section key={id} title={`What should happen to ${lines?.find((l) => l.removedModule === id)?.text.replace('Remove tab: ', '')}'s data?`} description="Either way, a backup zip is saved to your computer first.">
          <Segmented
            value={choice(id)}
            onChange={(v) => setDraft((d) => ({ ...d, removals: { ...d.removals, [id]: v } }))}
            options={[
              { value: 'dormant', label: 'Keep dormant', icon: <Archive className="size-4" /> },
              { value: 'delete', label: 'Delete data & free space', icon: <Trash2 className="size-4" /> },
            ]}
          />
          <p className="text-[12.5px] text-muted">
            {choice(id) === 'dormant'
              ? 'The tab disappears; its tables and files stay (admins can still read them). Re-adding the tab later restores everything instantly.'
              : 'Its tables, files and scheduled jobs are deleted to free space. Connections with other tabs are removed; the other tabs keep their data.'}
          </p>
        </Section>
      ))}
      {deleting.length > 0 && (
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium">
            Type <strong>{confirmText}</strong> to confirm deleting data
          </span>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} className="w-40" />
        </label>
      )}
      <Section title="Put it live" description="Three steps, in order. Each one shows what it's doing, and turns green when it worked.">
        <ol className="space-y-4">
          <li className="space-y-2">
            <ActionButton
              state={applyAction.state}
              label="1. Apply to database"
              doneLabel="1. Database updated"
              icon={<Database className="size-4" />}
              onClick={apply}
              disabled={!lines?.length || (deleting.length > 0 && typed !== confirmText) || !server.supabase.connected}
            />
            {!server.supabase.connected && <Banner tone="warning">Connect Supabase first (wizard home &gt; Connect).</Banner>}
            <Checklist steps={applyAction.steps} />
            {applyAction.error && <Banner tone="danger" title="Nothing was changed">The database update runs as one step and was rolled back: {applyAction.error}</Banner>}
            {applyAction.state === 'failed' && !applyAction.error && (
              <p className="text-[12.5px] text-danger">The database is updated, but a step after it didn't finish (see the list). Fix it and run step 1 again; it's safe to repeat.</p>
            )}
          </li>
          <li className="space-y-2">
            <ActionButton
              state={buildAction.state}
              label="2. Test build"
              doneLabel="2. The site builds"
              icon={<Hammer className="size-4" />}
              onClick={build}
              disabled={!draft.done.applied}
              current={applyAction.state === 'done' || (draft.done.applied && applyAction.state === 'idle')}
            />
            {!draft.done.applied && <p className="text-[12.5px] text-muted">Starts by itself after step 1.</p>}
            <Checklist steps={buildAction.steps} />
            {buildAction.state === 'failed' && (
              <div className="space-y-1">
                <p className="text-[12.5px] text-danger">The build failed. Nothing was published and your live site is untouched.</p>
                {buildAction.result?.log && (
                  <button type="button" className="text-[12.5px] text-accent hover:underline" aria-expanded={showBuildLog} onClick={() => setShowBuildLog(!showBuildLog)}>
                    {showBuildLog ? 'Hide' : 'Show'} details
                  </button>
                )}
                {showBuildLog && <pre className="max-h-60 relative overflow-auto rounded-md bg-bg-subtle p-2 text-[11px]">{buildAction.result?.log ?? buildAction.error}</pre>}
                {buildAction.error && <p className="text-[12.5px] text-danger">{buildAction.error}</p>}
              </div>
            )}
          </li>
          <li className="space-y-2">
            {buildAction.state === 'done' ? (
              <PublishButton
                message="Update TeamHub configuration"
                label="3. Commit & push"
                doneLabel="3. Uploaded: your site is rebuilding"
                next="you're done. Your host puts the new version live in a minute or two; reload your site then."
                onDone={() => {
                  setPublished(true);
                  setDraft((d) => ({ ...d, done: { ...d.done, published: true } }));
                }}
              />
            ) : (
              <Button icon={<GitBranch className="size-4" />} disabled>
                3. Commit &amp; push
              </Button>
            )}
            {buildAction.state !== 'done' && <p className="text-[12.5px] text-muted">Puts the change on your website. Ready once the test build passes.</p>}
          </li>
        </ol>
        {!published && applyAction.state === 'done' && buildAction.state === 'running' && <NextStep>wait for the test build, then Commit &amp; push.</NextStep>}
        {buildAction.state === 'done' && !published && <NextStep>3. Commit &amp; push, to put it on your website.</NextStep>}
      </Section>
    </StepShell>
  );
}
