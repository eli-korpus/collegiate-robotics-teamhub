import { useState } from 'react';
import { CheckCircle2, Clock, GitBranch, Database, Plus, Trash2, Upload, Wallet } from 'lucide-react';
import { Banner, Button, Card, Field, IconButton, Input, PRESET_ACCENTS, Segmented, Select, Spinner, cn, deriveAccent, toast, useConfirm } from '@teamhub/ui';
import { defaultSeasonLabel, seasonYear } from '@teamhub/config-schema/util';
import { getTeam } from '@teamhub/sdk/ftcscout';
import { api } from '../api';
import { processLogo, Section, StepShell, Why } from '../components';
import { dropMissingTeamRefs, useDraft } from '../draft';

export interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function Welcome({ onNext }: StepProps) {
  return (
    <StepShell
      title="Welcome to TeamHub FTC"
      subtitle="An open-source team dashboard for FIRST Tech Challenge teams. This wizard sets everything up (your teams, your tabs, your database and your website) and you can change any of it later."
      onNext={onNext}
      nextLabel="Let's start"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { icon: GitBranch, title: 'A GitHub account', body: 'Your copy (fork) of TeamHub lives there. Your website rebuilds from it automatically.' },
          { icon: Database, title: 'A Supabase account', body: 'Your team’s own database and logins, on the free plan. Nobody else can see your data.' },
          { icon: Clock, title: 'About 30 minutes', body: 'You can stop any time: progress saves automatically and you’ll resume where you left off.' },
          { icon: Wallet, title: '$0 on free plans', body: 'Supabase free + Cloudflare, Vercel, Netlify or GitHub Pages hosting. No credit card needed.' },
        ].map(({ icon: I, title, body }) => (
          <Card key={title} className="flex gap-3 p-4">
            <I className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="font-semibold">{title}</p>
              <p className="mt-0.5 text-[13px] text-muted">{body}</p>
            </div>
          </Card>
        ))}
      </div>
      <Why title="What exactly will this wizard do?">
        <ol className="list-decimal space-y-1 pl-5">
          <li>Ask about your program, teams, colors and which tabs you want.</li>
          <li>Build your Supabase database for exactly those tabs (nothing extra).</li>
          <li>Create your admin account.</li>
          <li>Save your settings to your GitHub fork and help you connect a free host.</li>
        </ol>
        <p>Your Supabase access token stays on this computer. Nothing is sent anywhere except to Supabase and GitHub.</p>
      </Why>
    </StepShell>
  );
}

export function Program({ onNext, onBack }: StepProps) {
  const { draft, update } = useDraft();
  const c = draft.config;
  const [busy, setBusy] = useState(false);
  return (
    <StepShell title="Your program" subtitle="A program is your whole club: one school or organization. It can have one FTC team or several." onBack={onBack} onNext={onNext}>
      <Field label="Program name" required hint='e.g. "Example Robotics": shown at the top of the dashboard and on the login page.'>
        {(id) => <Input id={id} autoFocus value={c.program.name} maxLength={80} onChange={(e) => update((x) => void (x.program.name = e.target.value))} />}
      </Field>
      <Field label="Program logo" optional hint="Square works best. If you skip this, your first team's logo is used.">
        {() => (
          <LogoPicker
            value={c.program.logo}
            busy={busy}
            onPick={async (file) => {
              setBusy(true);
              try {
                const p = await processLogo(file);
                const res = await api<{ path: string }>('/branding', { name: `program.${p.ext}`, dataUrl: p.main });
                await api('/branding', { name: 'favicon.png', dataUrl: p.favicon });
                await api('/branding', { name: 'apple-touch-icon.png', dataUrl: p.apple });
                await api('/branding', { name: 'social.jpg', dataUrl: p.social });
                update((x) => {
                  x.program.logo = `${res.path}?v=${Date.now().toString(36)}`;
                  if (p.suggestedColor && x.theme.accent === '#2563EB') x.theme.accent = p.suggestedColor.toUpperCase();
                });
              } catch (e) {
                toast.error((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
            onClear={() => update((x) => void (x.program.logo = null))}
          />
        )}
      </Field>
    </StepShell>
  );
}

export function logoUrl(path: string | null): string | null {
  return path ? `/__team/${path}` : null;
}

function LogoPicker({ value, onPick, onClear, busy }: { value: string | null; onPick: (f: File) => void; onClear: () => void; busy?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-16 place-items-center overflow-hidden rounded-lg border border-border bg-surface">
        {busy ? <Spinner /> : preview || value ? <img src={preview ?? logoUrl(value)!} alt="" className="size-full object-contain" /> : <Upload className="size-5 text-faint" />}
      </span>
      <label className="cursor-pointer">
        <span className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium shadow-sm hover:bg-bg-subtle">{value ? 'Replace' : 'Upload logo'}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setPreview(URL.createObjectURL(f));
              onPick(f);
            }
          }}
        />
      </label>
      {value && (
        <Button
          variant="ghost"
          onClick={() => {
            setPreview(null);
            onClear();
          }}
        >
          Remove
        </Button>
      )}
    </div>
  );
}

export function Teams({ onNext, onBack }: StepProps) {
  const { draft, update } = useDraft();
  const confirm = useConfirm();
  const c = draft.config;
  const [looking, setLooking] = useState<number | null>(null);
  const [found, setFound] = useState<Record<number, string>>({});
  const valid = c.teams.every((t) => t.name.trim() && /^[A-Za-z0-9]{1,4}$/.test(t.shortCode)) && new Set(c.teams.map((t) => t.shortCode.toUpperCase())).size === c.teams.length;

  const lookup = async (i: number, num: number) => {
    setLooking(i);
    try {
      const t = await getTeam(num);
      if (t) {
        update((x) => {
          const team = x.teams[i];
          if (!team.name) team.name = t.name;
          team.school = t.schoolName;
          team.city = [t.location?.city, t.location?.state].filter(Boolean).join(', ') || null;
        });
        setFound({ ...found, [num]: `${t.name}${t.schoolName ? ` · ${t.schoolName}` : ''}${t.location?.city ? ` · ${t.location.city}` : ''}` });
      } else setFound({ ...found, [num]: 'Not found on FTCScout (that’s OK for new teams).' });
    } catch {
      setFound({ ...found, [num]: 'FTCScout is unavailable. Fill in the name yourself.' });
    } finally {
      setLooking(null);
    }
  };

  return (
    <StepShell title={c.program.multiTeam ? 'Your teams' : 'Your team'} subtitle="Enter the FTC team number and we’ll look up the details on FTCScout." onBack={onBack} onNext={() => valid && onNext()}>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">How many FTC teams does your program have?</p>
        <Segmented
          value={c.program.multiTeam ? 'multi' : 'single'}
          onChange={async (v) => {
            if (v === 'single' && c.teams.length > 1) {
              const keep = c.teams[0].name || 'the first team';
              const ok = await confirm({ title: 'Switch to one team?', body: `Only ${keep} is kept. The other ${c.teams.length - 1} team${c.teams.length > 2 ? 's are' : ' is'} removed, along with any links set up for them.`, confirmLabel: 'Keep one team', danger: true });
              if (!ok) return;
            }
            update((x) => {
              x.program.multiTeam = v === 'multi';
              if (!x.program.multiTeam) x.teams = x.teams.slice(0, 1);
              dropMissingTeamRefs(x);
            });
          }}
          options={[
            { value: 'single', label: 'One team' },
            { value: 'multi', label: 'Several teams' },
          ]}
        />
        <p className="text-[12.5px] text-muted">
          {c.program.multiTeam
            ? 'Add each team below. Items can then belong to one team or the whole program, and people can switch between teams.'
            : 'Running several FTC teams in one club? Choose Several teams to add them.'}
        </p>
      </div>
      {c.teams.map((t, i) => (
        <Section key={t.id} title={c.program.multiTeam ? `Team ${i + 1}` : 'Team details'}>
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label="Team number" optional>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={t.number ?? ''}
                  onChange={(e) => update((x) => void (x.teams[i].number = e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null))}
                  onBlur={() => t.number && lookup(i, t.number)}
                />
              )}
            </Field>
            <Field label="Team name" required>{(id) => <Input id={id} value={t.name} maxLength={80} onChange={(e) => update((x) => void (x.teams[i].name = e.target.value))} />}</Field>
          </div>
          {looking === i && <p className="text-[12.5px] text-muted">Looking up on FTCScout…</p>}
          {t.number && found[t.number] && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <CheckCircle2 className="size-3.5 text-success" /> {found[t.number]}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field
              label="Short code"
              required
              hint="1–4 letters, e.g. A"
              error={
                t.shortCode && !/^[A-Za-z0-9]{1,4}$/.test(t.shortCode)
                  ? 'Use 1–4 letters or numbers.'
                  : t.shortCode && c.teams.some((o, j) => j !== i && o.shortCode.toUpperCase() === t.shortCode.toUpperCase())
                    ? 'Another team already uses this code.'
                    : undefined
              }
            >
              {(id) => <Input id={id} value={t.shortCode} maxLength={4} onChange={(e) => update((x) => void (x.teams[i].shortCode = e.target.value.toUpperCase()))} />}
            </Field>
            <Field label="Team color" hint="Shown as a dot on this team's items.">
              {(id) => (
                <div className="flex items-center gap-2">
                  <input id={id} type="color" value={t.color} onChange={(e) => update((x) => void (x.teams[i].color = e.target.value.toUpperCase()))} className="h-9 w-12 cursor-pointer rounded border border-border bg-surface" />
                  <Input value={t.color} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && update((x) => void (x.teams[i].color = e.target.value.toUpperCase()))} className="w-28" />
                </div>
              )}
            </Field>
          </div>
          <Field label="Team logo" optional>
            {() => (
              <LogoPicker
                value={t.logo}
                onPick={async (file) => {
                  try {
                    const p = await processLogo(file);
                    const res = await api<{ path: string }>('/branding', { name: `team-${t.shortCode.toLowerCase()}.${p.ext}`, dataUrl: p.main });
                    if (!c.program.logo && i === 0) {
                      await api('/branding', { name: 'favicon.png', dataUrl: p.favicon });
                      await api('/branding', { name: 'apple-touch-icon.png', dataUrl: p.apple });
                      await api('/branding', { name: 'social.jpg', dataUrl: p.social });
                    }
                    update((x) => {
                      x.teams[i].logo = `${res.path}?v=${Date.now().toString(36)}`;
                      if (p.suggestedColor) x.teams[i].color = p.suggestedColor.toUpperCase();
                    });
                    if (p.suggestedColor) toast.info('Picked the team color from the logo. Change it if you like.');
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
                onClear={() => update((x) => void (x.teams[i].logo = null))}
              />
            )}
          </Field>
          {c.teams.length > 1 && (
            <div className="flex justify-end">
              <IconButton
                label="Remove team"
                onClick={() =>
                  update((x) => {
                    x.teams.splice(i, 1);
                    dropMissingTeamRefs(x);
                  })
                }
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          )}
        </Section>
      ))}
      {c.program.multiTeam && (
        <Button
          icon={<Plus className="size-4" />}
          onClick={() =>
            update((x) =>
              void x.teams.push({
                id: crypto.randomUUID(),
                number: null,
                name: '',
                shortCode: String.fromCharCode(65 + x.teams.length),
                color: ['#16A34A', '#E11D48', '#F97316', '#8B5CF6'][x.teams.length % 4],
                logo: null,
                logoDark: null,
                school: null,
                city: null,
              }),
            )
          }
        >
          Add another team
        </Button>
      )}
      {!valid && <p className="text-[12.5px] text-muted">Each team needs a name and a unique short code.</p>}
    </StepShell>
  );
}

export function Look({ onNext, onBack }: StepProps) {
  const { draft, update } = useDraft();
  const t = draft.config.theme;
  let notes: string[] = [];
  try {
    const l = deriveAccent(t.accent, 'light');
    const d = deriveAccent(t.accent, 'dark');
    if (l.adjusted) notes.push(`In light mode your accent is darkened to ${l.accent} so text stays readable.`);
    if (d.adjusted) notes.push(`In dark mode it is lightened to ${d.accent}.`);
  } catch {
    notes = [];
  }
  return (
    <StepShell title="Look & feel" subtitle="TeamHub keeps a calm, neutral look and uses your color for buttons, selection and highlights." onBack={onBack} onNext={onNext}>
      <Section title="Accent color">
        <div className="flex flex-wrap gap-2">
          {PRESET_ACCENTS.map((p) => (
            <button
              key={p.hex}
              type="button"
              title={p.name}
              aria-label={p.name}
              aria-pressed={t.accent === p.hex}
              onClick={() => update((x) => void (x.theme.accent = p.hex))}
              className={cn('size-9 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-105', t.accent === p.hex && 'ring-2 ring-fg')}
              style={{ background: p.hex }}
            />
          ))}
          <label className="flex items-center gap-2 text-[13px]">
            <input type="color" value={t.accent} onChange={(e) => update((x) => void (x.theme.accent = e.target.value.toUpperCase()))} className="h-9 w-12 cursor-pointer rounded border border-border" />
            Custom
          </label>
        </div>
        {notes.map((n) => (
          <Banner key={n} tone="info">
            {n}
          </Banner>
        ))}
      </Section>
      <Section title="Corners">
        <Segmented
          value={t.corners}
          onChange={(v) => update((x) => void (x.theme.corners = v))}
          options={[
            { value: 'soft', label: 'Soft (rounded)' },
            { value: 'sharp', label: 'Sharp' },
          ]}
        />
      </Section>
      <Section title="Default theme" description="Everyone can still switch between light and dark on their own device.">
        <Segmented
          value={t.defaultMode}
          onChange={(v) => update((x) => void (x.theme.defaultMode = v))}
          options={[
            { value: 'system', label: 'Match device' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Section>
      <Section title="Season">
        <Field
          label="Current FTC season"
          hint="Already picked for you from today's date. Seasons are named by their years (they start in September), not by the game's name. It sets which FTCScout results you see and tags new data. You only change it once a year, with New Season."
        >
          {(id) => (
            <Select id={id} value={draft.config.season} onChange={(e) => update((x) => void (x.season = e.target.value))} className="w-56">
              {seasonChoices(draft.config.season).map((s) => (
                <option key={s} value={s}>
                  {s} season
                </option>
              ))}
            </Select>
          )}
        </Field>
      </Section>
    </StepShell>
  );
}

/** Last, current and next FTC season (plus the saved one, if it's something else). */
function seasonChoices(saved: string): string[] {
  const y = seasonYear(defaultSeasonLabel());
  const list = [y - 1, y, y + 1].map((n) => defaultSeasonLabel(new Date(n, 8, 1)));
  return list.includes(saved) ? list : [saved, ...list];
}
