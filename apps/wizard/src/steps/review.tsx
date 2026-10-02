import { useEffect, useState } from 'react';
import { Archive, CheckCircle2, Hammer, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import type { TeamhubConfig } from '@teamhub/config-schema';
import { Banner, Button, Input, Segmented, Spinner, cn, toast } from '@teamhub/ui';
import { api } from '../api';
import { Section, StepShell } from '../components';
import { useDraft } from '../draft';
import { ApplyLog } from './connect';
import { PublishButton } from './publish';
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
  const [busy, setBusy] = useState<'apply' | 'build' | null>(null);
  const [log, setLog] = useState<{ step: string; ok: boolean; detail?: string }[] | null>(null);
  const [buildLog, setBuildLog] = useState<{ ok: boolean; log: string } | null>(null);
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

  const apply = async () => {
    setBusy('apply');
    setLog(null);
    try {
      const cfg = finalConfig();
      const dormantNow = Object.entries(cfg.modules).filter(([id, m]) => m.state === 'dormant' && server.config!.modules[id]?.state !== 'dormant').map(([id]) => id);
      const r = await api<{ log: { step: string; ok: boolean; detail?: string }[]; backup?: { path: string } }>('/apply', { config: cfg, backupModules: [...removed, ...dormantNow.filter((d) => !removed.includes(d))] });
      await api('/config', cfg);
      setLog(r.log);
      setDraft((d) => ({ ...d, done: { ...d.done, applied: true } }));
    } catch (e) {
      setLog([{ step: 'Nothing was changed — the update runs as one transaction and was rolled back.', ok: false, detail: (e as Error).message }]);
    } finally {
      setBusy(null);
    }
  };

  const build = async () => {
    setBusy('build');
    const r = await api<{ ok: boolean; log: string }>('/build', {});
    setBuildLog(r);
    setBusy(null);
  };

  return (
    <StepShell title="Review & apply" subtitle="Here's everything that will change. Removing a tab always exports its data first." onBack={onBack}>
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
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={apply} loading={busy === 'apply'} disabled={!lines?.length || (deleting.length > 0 && typed !== confirmText) || !server.supabase.connected}>
          1. Apply to database
        </Button>
        <Button icon={<Hammer className="size-4" />} onClick={build} loading={busy === 'build'} disabled={!draft.done.applied}>
          2. Test build
        </Button>
      </div>
      {!server.supabase.connected && <Banner tone="warning">Connect Supabase first (wizard home &gt; Connect).</Banner>}
      {log && <ApplyLog log={log} />}
      {buildLog && (
        <div className={cn('rounded-md border p-3 text-[12.5px]', buildLog.ok ? 'border-success/40' : 'border-danger/40')}>
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            {buildLog.ok ? (
              <>
                <CheckCircle2 className="size-4 text-success" /> The site builds. Push to publish it.
              </>
            ) : (
              'The build failed — your live site is untouched. Details:'
            )}
          </p>
          {!buildLog.ok && <pre className="max-h-60 overflow-auto text-[11px]">{buildLog.log}</pre>}
        </div>
      )}
      {buildLog?.ok && <PublishButton message="Update TeamHub configuration" label="3. Commit & push (your host redeploys)" onDone={() => setDraft((d) => ({ ...d, done: { ...d.done, published: true } }))} />}
    </StepShell>
  );
}
