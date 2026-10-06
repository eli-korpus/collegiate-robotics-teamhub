import { useEffect, useState, type ComponentType } from 'react';
import { Check, Moon, RotateCcw, Sun } from 'lucide-react';
import { Banner, Button, ErrorState, IconButton, Spinner, cn, useConfirm } from '@teamhub/ui';
import { api, type Catalog, type Draft, type ServerState } from './api';
import { DraftProvider, hasSeveralTeams, newDraft, useDraft } from './draft';
import { Preview } from './components';
import { Look, Program, Teams, Welcome, logoUrl, type StepProps } from './steps/basics';
import { ChooseTabs, TabOptions, recomputeHomeDefaults } from './steps/tabs';
import { People, Permissions } from './steps/people';
import { AdminAccount, ConnectSupabase, ToolLinksStep } from './steps/connect';
import { Done, Host, KeepAlive, Publish } from './steps/publish';
import { Review } from './steps/review';
import { ExistingHome } from './home/Home';

interface StepDef {
  id: string;
  label: string;
  C: ComponentType<StepProps>;
  doneKey?: keyof Draft['done'];
}

const SETUP: StepDef[] = [
  { id: 'welcome', label: 'Welcome', C: Welcome },
  { id: 'program', label: 'Program', C: Program },
  { id: 'teams', label: 'Teams', C: Teams },
  { id: 'look', label: 'Look & feel', C: Look },
  { id: 'tabs', label: 'Choose tabs', C: ChooseTabs },
  { id: 'options', label: 'Tab options', C: TabOptions },
  { id: 'people', label: 'People & positions', C: People },
  { id: 'permissions', label: 'Permissions', C: Permissions },
  { id: 'links', label: 'Tool links', C: ToolLinksStep },
  { id: 'supabase', label: 'Connect Supabase', C: ConnectSupabase, doneKey: 'applied' },
  { id: 'admin', label: 'Admin account', C: AdminAccount, doneKey: 'admin' },
  { id: 'publish', label: 'Publish', C: Publish, doneKey: 'published' },
  { id: 'host', label: 'Host it', C: Host, doneKey: 'hosted' },
  { id: 'keepalive', label: 'Keep-alive', C: KeepAlive, doneKey: 'keepalive' },
  { id: 'done', label: 'Done', C: Done as ComponentType<StepProps> },
];

const EDIT: StepDef[] = [
  { id: 'program', label: 'Program', C: Program },
  { id: 'teams', label: 'Teams', C: Teams },
  { id: 'look', label: 'Look & feel', C: Look },
  { id: 'tabs', label: 'Tabs', C: ChooseTabs },
  { id: 'options', label: 'Tab options', C: TabOptions },
  { id: 'people', label: 'People & positions', C: People },
  { id: 'permissions', label: 'Permissions', C: Permissions },
  // No Tool links step: after setup they live only in the database and are edited in the dashboard (Admin > Tool links).
  { id: 'review', label: 'Review & apply', C: Review, doneKey: 'applied' },
];

/** Steps that need earlier ones done (you can't create an admin before the database exists). */
const GATES: Record<string, keyof Draft['done']> = { admin: 'applied', publish: 'admin', host: 'published', keepalive: 'published', done: 'published' };

export function App() {
  const [server, setServer] = useState<ServerState | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    try {
      const [s, c] = await Promise.all([api<ServerState>('/state'), api<Catalog>('/catalog')]);
      setServer(s);
      setCatalog(c);
      if (s.draft && (s.mode === 'setup' || s.draft.flow === 'edit')) setDraft(s.draft);
      else if (s.mode === 'setup') {
        const d = newDraft('setup');
        recomputeHomeDefaults(d.config, c.modules);
        setDraft(d);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState title="The wizard server isn't responding" error={error} retry={load} />;
  if (!server || !catalog) return <div className="grid h-dvh place-items-center"><Spinner /></div>;
  if (server.configInvalid)
    return (
      <div className="mx-auto max-w-xl p-10">
        <Banner tone="danger" title="team/teamhub.config.json has problems">
          Fix the file by hand (see docs/configuration.md) or delete it to start setup again.
        </Banner>
      </div>
    );
  if (!draft) {
    return (
      <ExistingHome
        server={server}
        catalog={catalog}
        refresh={async () => setServer(await api('/state'))}
        onEdit={() => setDraft(newDraft('edit', server.config))}
      />
    );
  }
  return (
    <DraftProvider
      key={draft.flow}
      initial={draft}
      catalog={catalog}
      server={server}
      onExit={async (d) => {
        setDraft(d);
        setServer(await api('/state'));
      }}
    >
      <Layout />
    </DraftProvider>
  );
}

function Layout() {
  const { draft, go, catalog, reset } = useDraft();
  const confirm = useConfirm();
  const steps = draft.flow === 'setup' ? SETUP : EDIT;
  const idx = Math.min(draft.step, steps.length - 1);
  const Step = steps[idx].C;
  const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const c = draft.config;
  const reachable = (i: number) => {
    const gate = GATES[steps[i].id];
    return !gate || draft.flow === 'edit' || !!draft.done[gate];
  };
  const showPreview = !['supabase', 'admin', 'publish', 'host', 'keepalive', 'done', 'review'].includes(steps[idx].id);

  return (
    <div className="flex h-dvh">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-bg-subtle/60 md:flex">
        <div className="px-4 pb-3 pt-5">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">{draft.flow === 'setup' ? 'Set up TeamHub' : 'Edit your dashboard'}</p>
          <p className="mt-0.5 truncate text-[14px] font-semibold">{c.program.name || 'New program'}</p>
        </div>
        <ol className="min-h-0 flex-1 space-y-px relative overflow-y-auto px-2">
          {steps.map((s, i) => {
            const done = s.doneKey ? !!draft.done[s.doneKey] : i < idx;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!reachable(i)}
                  onClick={() => go(i)}
                  aria-current={i === idx ? 'step' : undefined}
                  className={cn(
                    'flex h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] disabled:opacity-40',
                    i === idx ? 'bg-accent-soft font-medium text-fg' : 'text-fg/80 hover:bg-bg-subtle',
                  )}
                >
                  <span className={cn('grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-semibold', done ? 'bg-success text-white' : i === idx ? 'bg-accent text-accent-fg' : 'bg-bg-subtle text-muted')}>
                    {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  {s.label}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="border-t border-border p-2">
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw className="size-3.5" />}
            onClick={async () => {
              const editing = draft.flow === 'edit';
              if (!(await confirm({ title: editing ? 'Discard these edits?' : 'Start setup over?', body: editing ? 'Nothing has been applied unless you clicked Apply. Logos you uploaded in this edit are put back too.' : 'Your answers are cleared. Nothing in Supabase or GitHub is undone.', danger: true, confirmLabel: editing ? 'Discard' : 'Start over' }))) return;
              await api('/draft', undefined, 'DELETE');
              if (editing) reset(null);
              else location.reload();
            }}
          >
            {draft.flow === 'edit' ? 'Back to wizard home' : 'Start over'}
          </Button>
        </div>
      </aside>
      <main id="wizard-main" className="min-w-0 flex-1 relative overflow-y-auto">
        <div className="border-b border-border px-5 py-2 text-[12.5px] text-muted md:hidden">
          Step {idx + 1} of {steps.length}: {steps[idx].label}
        </div>
        <Step key={steps[idx].id} onNext={() => go(Math.min(idx + 1, steps.length - 1))} onBack={idx > 0 ? () => go(idx - 1) : undefined} />
      </main>
      {showPreview && (
        <aside className="hidden w-[460px] shrink-0 relative overflow-y-auto border-l border-border bg-bg-subtle/40 p-5 xl:block">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-faint">Preview</p>
            <IconButton label={dark ? 'Preview light mode' : 'Preview dark mode'} size="sm" onClick={() => setDark(!dark)}>
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </IconButton>
          </div>
          <Preview
            programName={c.program.name}
            logo={logoUrl(c.program.logo ?? c.teams[0]?.logo ?? null)}
            accent={c.theme.accent}
            corners={c.theme.corners}
            dark={dark}
            teams={hasSeveralTeams(c) ? c.teams.map((t) => ({ name: t.name || t.shortCode, color: t.color })) : []}
            tabs={catalog.modules.filter((m) => m.id in c.modules).map((m) => ({ name: m.name, icon: m.icon, category: m.category }))}
          />
        </aside>
      )}
    </div>
  );
}
