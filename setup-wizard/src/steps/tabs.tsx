import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Files, Link2 } from 'lucide-react';
import { Badge, Banner, Button, Dialog, IconButton, Markdown, Segmented, cn } from '@teamhub/ui';
import { positionIdFor } from '@teamhub/config-schema';
import type { CatalogModule } from '../api';
import { ModuleIcon, SchemaForm, Section, StepShell, Why, type PositionChoice } from '../components';
import { useDraft } from '../draft';
import type { StepProps } from './basics';

const CATEGORIES = [
  { id: 'team', label: 'Team' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'competition', label: 'Competition' },
  { id: 'outreach', label: 'Outreach & Business' },
] as const;

const STARTER = ['calendar', 'attendance', 'announcements', 'bulletin', 'tasks'];
const COMPETITIVE = [...STARTER, 'events', 'competition-day', 'scouting', 'checklists', 'batteries', 'notebook', 'judging'];

const CORE_WIDGETS = [
  { key: 'core:approvals', title: 'Join requests (approvers)' },
  { key: 'core:request-info', title: 'Info requested from you' },
  { key: 'core:team', title: 'Team info' },
  { key: 'core:links', title: 'Team tools' },
  { key: 'core:activity', title: 'Recent activity' },
];

export function ChooseTabs({ onNext, onBack }: StepProps) {
  const { draft, update, catalog } = useDraft();
  const selected = new Set(Object.keys(draft.config.modules));
  const [info, setInfo] = useState<CatalogModule | null>(null);
  const byId = new Map(catalog.modules.map((m) => [m.id, m]));

  const setSelection = (ids: string[]) =>
    update((c) => {
      const next: typeof c.modules = {};
      for (const id of ids) if (byId.has(id)) next[id] = c.modules[id] ?? { state: 'active', settings: {} };
      c.modules = next;
      recomputeHomeDefaults(c, catalog.modules);
    });
  const toggle = (id: string) => setSelection(selected.has(id) ? [...selected].filter((x) => x !== id) : [...selected, id]);

  const unlocked = catalog.integrations.filter((i) => i.requires.every((r) => selected.has(r)));
  const files = [...selected].filter((id) => byId.get(id)?.usesFiles).map((id) => byId.get(id)!.name);

  return (
    <StepShell
      title="Choose your tabs"
      subtitle="Pick only what your team will use: every tab works on its own, and you can add or remove tabs later without losing data. Unpicked tabs add nothing to your site or database."
      onBack={onBack}
      onNext={onNext}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-medium text-muted">Presets:</span>
        <Button size="sm" onClick={() => setSelection(STARTER)}>
          Starter
        </Button>
        <Button size="sm" onClick={() => setSelection(COMPETITIVE)}>
          Competitive
        </Button>
        <Button size="sm" onClick={() => setSelection(catalog.modules.map((m) => m.id))}>
          Everything
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSelection([])}>
          Clear
        </Button>
        <span className="ml-auto text-[13px] text-muted">{selected.size} selected</span>
      </div>
      {CATEGORIES.map((cat) => (
        <section key={cat.id}>
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">{cat.label}</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {catalog.modules
              .filter((m) => m.category === cat.id)
              .map((m) => {
                const on = selected.has(m.id);
                return (
                  <div key={m.id} className={cn('flex flex-col rounded-lg border bg-surface p-3 shadow-sm transition-colors', on ? 'border-accent ring-1 ring-accent' : 'border-border')}>
                    <button type="button" onClick={() => toggle(m.id)} aria-pressed={on} className="flex items-start gap-3 text-left">
                      <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', on ? 'bg-accent text-accent-fg' : 'bg-bg-subtle text-muted')}>
                        <ModuleIcon name={m.icon} className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-semibold">
                          {m.name} {on && <Check className="size-4 text-accent" />}
                        </span>
                        <span className="block text-[12.5px] text-muted">{m.summary}</span>
                      </span>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-12 text-[11.5px]">
                      <span className="text-muted">{m.footprint}</span>
                      {m.usesFiles && (
                        <Badge tone="warning">
                          <Files className="size-3" /> uses file storage
                        </Badge>
                      )}
                      <button type="button" className="ml-auto font-medium text-accent hover:underline" onClick={() => setInfo(m)}>
                        Details
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      ))}
      {unlocked.length > 0 && (
        <Section title="Connections unlocked by your picks" description="These only exist because both tabs are enabled. Nothing breaks if you remove one later.">
          <ul className="space-y-1.5 text-[13px]">
            {unlocked.map((i) => (
              <li key={i.id} className="flex items-start gap-2">
                <Link2 className="mt-0.5 size-4 shrink-0 text-accent" />
                <span>
                  <strong className="font-medium">{i.requires.map((r) => byId.get(r)?.name).join(' + ')}:</strong> {i.summary}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {files.length > 0 && (
        <Banner tone="info" title="About file storage">
          {files.join(', ')} can store files. The free plan has 1 GB, so photos are compressed automatically, files have size limits, and every upload offers “paste a link
          instead”. You can watch usage in Admin &gt; Storage.
        </Banner>
      )}
      <Why title="Why not just pick everything?">
        <p>Each tab adds screens to learn and a little to your database. Teams that start small and add tabs when they need them tend to actually use them.</p>
        <p>Every tab has one clear job (e.g. Polls are not for collecting shirt sizes; People &gt; Request info is). The details show what each tab is and is not for.</p>
      </Why>
      <Dialog open={!!info} onOpenChange={(v) => !v && setInfo(null)} title={info?.name} description={info?.summary} size="lg">
        {info && (
          <div className="space-y-3 text-[13.5px]">
            <p>
              <strong>Purpose:</strong> {info.purpose}
            </p>
            {info.notFor.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-5 text-muted">
                {info.notFor.map((n) => (
                  <li key={n.text}>
                    Not for {n.text.charAt(0).toLowerCase() + n.text.slice(1)}: use {n.goTo.startsWith('link:') ? 'your tool links' : n.goTo.startsWith('core:') ? 'People' : byId.get(n.goTo)?.name ?? n.goTo}
                  </li>
                ))}
              </ul>
            )}
            <p>
              <strong>Stores:</strong> {info.stores} <span className="text-muted">({info.footprint})</span>
            </p>
            {info.readme && <Markdown source={info.readme.replace(/^# .*\n/, '')} className="rounded-md bg-bg-subtle p-3 text-[13px]" />}
          </div>
        )}
      </Dialog>
    </StepShell>
  );
}

/** Default Home widgets per profile type: core widgets + each module's widgets that target that type. */
export function recomputeHomeDefaults(c: { modules: Record<string, unknown>; home: { defaults: Record<string, string[]> } }, modules: CatalogModule[]) {
  for (const type of ['member', 'captain', 'mentor'] as const) {
    const keys = [
      ...(type === 'member' ? [] : ['core:approvals']),
      'core:request-info',
      ...modules.filter((m) => m.id in c.modules).flatMap((m) => m.widgets.filter((w) => w.defaultFor.includes(type)).map((w) => `${m.id}:${w.id}`)),
      'core:team',
      'core:links',
      'core:activity',
    ];
    const prev = c.home.defaults[type] ?? [];
    c.home.defaults[type] = [...prev.filter((k) => keys.includes(k)), ...keys.filter((k) => !prev.includes(k))];
  }
}

export function TabOptions({ onNext, onBack }: StepProps) {
  const { draft, update, catalog } = useDraft();
  const chosen = catalog.modules.filter((m) => m.id in draft.config.modules);
  // Positions tab options can route to: the ones already added, plus ones your tabs suggest (offered in People & positions).
  const positionChoices: PositionChoice[] = [
    ...draft.config.positions.map((p) => ({ id: p.id, name: p.name, created: true })),
    ...[...new Set(chosen.flatMap((m) => m.suggestedPositions))]
      .filter((name) => !draft.config.positions.some((p) => p.id === positionIdFor(name)))
      .map((name) => ({ id: positionIdFor(name), name, created: false })),
  ];
  const withOptions = chosen.filter((m) => Object.keys(m.settingsSchema.properties ?? {}).length);
  const [homeType, setHomeType] = useState<'member' | 'captain' | 'mentor'>('member');
  const titles = useMemo(() => {
    const t: Record<string, string> = Object.fromEntries(CORE_WIDGETS.map((w) => [w.key, w.title]));
    for (const m of chosen) for (const w of m.widgets) t[`${m.id}:${w.id}`] = `${w.title} · ${m.name}`;
    return t;
  }, [chosen]);
  const list = draft.config.home.defaults[homeType] ?? [];
  const move = (i: number, d: -1 | 1) =>
    update((c) => {
      const l = [...(c.home.defaults[homeType] ?? [])];
      [l[i], l[i + d]] = [l[i + d], l[i]];
      c.home.defaults[homeType] = l;
    });

  return (
    <StepShell title="Tab options" subtitle="Each tab has a few choices. The defaults work well. Change only what you need." onBack={onBack} onNext={onNext}>
      {withOptions.length === 0 && <p className="text-[13.5px] text-muted">{chosen.length ? 'Your tabs have no options to set.' : 'You haven’t picked any tabs. That’s fine: the core (Home, People, Admin) always works.'}</p>}
      {withOptions.map((m) => (
        <Section key={m.id} title={m.name} description={m.purpose}>
          <SchemaForm
            schema={m.settingsSchema}
            value={{ ...m.settingsDefaults, ...((draft.config.modules[m.id]?.settings as Record<string, unknown>) ?? {}) }}
            onChange={(v) => update((c) => void (c.modules[m.id] = { ...c.modules[m.id], settings: v }))}
            positions={positionChoices}
          />
        </Section>
      ))}
      <Section title="Home page layout" description="The order widgets appear on Home for each kind of person. Everyone can still hide or reorder their own.">
        <Segmented
          size="sm"
          value={homeType}
          onChange={setHomeType}
          options={[
            { value: 'member', label: 'Members' },
            { value: 'captain', label: 'Captains' },
            { value: 'mentor', label: 'Mentors' },
          ]}
        />
        <ul className="divide-y divide-border rounded-md border border-border">
          {list.map((k, i) => (
            <li key={k} className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
              <span className="flex-1">{titles[k] ?? k}</span>
              <IconButton label="Move up" size="sm" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label="Move down" size="sm" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      </Section>
    </StepShell>
  );
}
