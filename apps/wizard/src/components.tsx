import { useState, type ReactNode } from 'react';
import { icons, ChevronDown, ChevronRight, HelpCircle, ArrowLeft, ArrowRight, Box } from 'lucide-react';
import { Button, Input, Select, Switch, Textarea, cn, deriveAccent, dominantColor, readableOn } from '@teamhub/ui';
import type { JsonSchema } from './api';

export function ModuleIcon({ name, className }: { name: string; className?: string }) {
  const I = (icons as Record<string, typeof Box>)[name] ?? Box;
  return <I className={className ?? 'size-4'} />;
}

/** "Why do we need this?" expander (spec §5.1). */
export function Why({ children, title = 'Why do we need this?' }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border bg-bg-subtle/60">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] font-medium text-muted">
        <HelpCircle className="size-4" />
        <span className="flex-1">{title}</span>
        {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
      </button>
      {open && <div className="space-y-2 px-3 pb-3 text-[13px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}

export function StepShell({
  title,
  subtitle,
  children,
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
  nextLoading,
  hideNext,
  footerExtra,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  hideNext?: boolean;
  footerExtra?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8">
      <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{subtitle}</p>}
      <div className="mt-6 space-y-5">{children}</div>
      <div className="mt-10 flex items-center gap-3 border-t border-border pt-5">
        {onBack && (
          <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={onBack}>
            Back
          </Button>
        )}
        <span className="flex-1" />
        {footerExtra}
        {!hideNext && onNext && (
          <Button variant="primary" size="lg" onClick={onNext} disabled={nextDisabled} loading={nextLoading}>
            {nextLabel} <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function Section({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div>
        <h2 className="text-[14.5px] font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Renders a module's settings form from its zod → JSON schema (spec §5.2 step 6). */
export function SchemaForm({ schema, value, onChange }: { schema: JsonSchema; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const props = schema.properties ?? {};
  if (!Object.keys(props).length) return <p className="text-[13px] text-faint">No options for this tab.</p>;
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      {Object.entries(props).map(([k, s]) => {
        const v = value[k] ?? s.default;
        const label = s.title ?? k;
        const type = Array.isArray(s.type) ? s.type[0] : s.type;
        if (type === 'boolean') return <Switch key={k} checked={!!v} onChange={(x) => set(k, x)} label={label} description={s.description} />;
        const field = (control: ReactNode) => (
          <label key={k} className="block space-y-1.5">
            <span className="block text-[13px] font-medium">{label}</span>
            {control}
            {s.description && <span className="block text-[12.5px] text-muted">{s.description}</span>}
          </label>
        );
        if (s.enum)
          return field(
            <Select value={String(v ?? '')} onChange={(e) => set(k, e.target.value)}>
              {s.enum.map((o) => (
                <option key={String(o)} value={String(o)}>
                  {String(o)}
                </option>
              ))}
            </Select>,
          );
        if (type === 'number' || type === 'integer')
          return field(<Input type="number" min={s.minimum} max={s.maximum} value={v == null ? '' : String(v)} onChange={(e) => set(k, e.target.value === '' ? undefined : Number(e.target.value))} className="max-w-40" />);
        if (type === 'array' && s.items?.type === 'string')
          return field(
            <Textarea
              rows={2}
              value={(Array.isArray(v) ? v : []).join(', ')}
              onChange={(e) => set(k, e.target.value.split(',').map((x) => x.trimStart()))}
              onBlur={(e) => set(k, e.target.value.split(',').map((x) => x.trim()).filter(Boolean))}
              placeholder="Separate items with commas"
            />,
          );
        if (type === 'array' && s.items?.properties) return field(<ObjectList schema={s.items} value={Array.isArray(v) ? (v as Record<string, unknown>[]) : []} onChange={(x) => set(k, x)} />);
        return field(<Input value={String(v ?? '')} onChange={(e) => set(k, e.target.value)} />);
      })}
    </div>
  );
}

function ObjectList({ schema, value, onChange }: { schema: JsonSchema; value: Record<string, unknown>[]; onChange: (v: Record<string, unknown>[]) => void }) {
  const cols = Object.entries(schema.properties ?? {});
  return (
    <div className="space-y-2">
      {value.map((row, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          {cols.map(([k, s]) => {
            const t = Array.isArray(s.type) ? s.type[0] : s.type;
            if (t === 'boolean') return <Switch key={k} checked={!!row[k]} onChange={(x) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: x } : r)))} label={s.title ?? k} />;
            if (t === 'array')
              return (
                <Input
                  key={k}
                  className="min-w-40 flex-1"
                  placeholder={s.title ?? k}
                  value={((row[k] as string[]) ?? []).join(', ')}
                  onChange={(e) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } : r)))}
                />
              );
            return <Input key={k} className="min-w-32 flex-1" placeholder={s.title ?? k} value={String(row[k] ?? '')} onChange={(e) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))} />;
          })}
          <Button size="sm" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            Remove
          </Button>
        </div>
      ))}
      <Button size="sm" onClick={() => onChange([...value, Object.fromEntries(cols.map(([k, s]) => [k, (Array.isArray(s.type) ? s.type[0] : s.type) === 'array' ? [] : (Array.isArray(s.type) ? s.type[0] : s.type) === 'boolean' ? false : '']))])}>
        Add
      </Button>
    </div>
  );
}

// ── Logo processing (in the browser: no native image libraries needed) ──────
export interface ProcessedLogo {
  main: string; // dataURL webp/svg
  ext: 'webp' | 'svg';
  favicon: string; // png 64
  apple: string; // png 180
  suggestedColor: string | null;
  preview: string;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Could not read that image'));
    img.src = src;
  });
}

function render(img: HTMLImageElement, size: number, type: string, padBg?: string): string {
  const c = document.createElement('canvas');
  const scale = Math.min(1, size / Math.max(img.naturalWidth || size, img.naturalHeight || size));
  const w = type === 'image/png' ? size : Math.round((img.naturalWidth || size) * scale);
  const h = type === 'image/png' ? size : Math.round((img.naturalHeight || size) * scale);
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  if (padBg) {
    ctx.fillStyle = padBg;
    ctx.fillRect(0, 0, w, h);
  }
  if (type === 'image/png') {
    const s = Math.min(w / (img.naturalWidth || w), h / (img.naturalHeight || h)) * 0.86;
    const dw = (img.naturalWidth || w) * s;
    const dh = (img.naturalHeight || h) * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL(type, 0.85);
}

export async function processLogo(file: File): Promise<ProcessedLogo> {
  if (file.size > 8 * 1024 * 1024) throw new Error('That image is over 8 MB — try a smaller one.');
  const dataUrl = await new Promise<string>((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.readAsDataURL(file);
  });
  const img = await loadImage(dataUrl);
  const sample = document.createElement('canvas');
  sample.width = 48;
  sample.height = 48;
  const sctx = sample.getContext('2d')!;
  sctx.drawImage(img, 0, 0, 48, 48);
  const suggestedColor = dominantColor(sctx.getImageData(0, 0, 48, 48).data);
  const isSvg = file.type === 'image/svg+xml';
  return {
    main: isSvg ? dataUrl : render(img, 512, 'image/webp'),
    ext: isSvg ? 'svg' : 'webp',
    favicon: render(img, 64, 'image/png'),
    apple: render(img, 180, 'image/png', '#FFFFFF'),
    suggestedColor,
    preview: dataUrl,
  };
}

/** A mini dashboard with the chosen logo, colors and tabs (spec §5.1 live preview). */
export function Preview({
  programName,
  logo,
  accent,
  corners,
  tabs,
  teams,
  dark,
}: {
  programName: string;
  logo: string | null;
  accent: string;
  corners: 'soft' | 'sharp';
  tabs: { name: string; icon: string; category: string }[];
  teams: { name: string; color: string }[];
  dark: boolean;
}) {
  let a = { accent: '#2563EB', hover: '#1D4ED8', contrast: '#FFFFFF' };
  try {
    a = deriveAccent(accent, dark ? 'dark' : 'light');
  } catch {}
  const r = corners === 'sharp' ? 5 : 11;
  const vars = {
    '--accent': a.accent,
    '--accent-hover': a.hover,
    '--accent-contrast': a.contrast,
    '--th-radius-sm': `${r - 3}px`,
    '--th-radius-md': `${r}px`,
    '--th-radius-lg': `${r + 4}px`,
  } as React.CSSProperties;
  const cats = ['team', 'engineering', 'competition', 'outreach'];
  return (
    <div className={cn(dark && 'dark')} style={vars}>
      <div className="overflow-hidden rounded-lg border border-border bg-bg text-fg shadow-md" style={{ fontSize: 11 }}>
        <div className="flex h-[360px]">
          <div className="w-[140px] shrink-0 space-y-1 border-r border-border bg-bg-subtle/60 p-2">
            <div className="mb-2 flex items-center gap-1.5">
              {logo ? (
                <img src={logo} alt="" className="size-6 rounded-md object-contain dark:bg-white/90" />
              ) : (
                <span className="grid size-6 place-items-center rounded-md bg-accent text-[10px] font-bold text-accent-fg">{(programName || 'T').slice(0, 1)}</span>
              )}
              <span className="truncate font-semibold">{programName || 'Your program'}</span>
            </div>
            <div className="rounded-md bg-accent-soft px-1.5 py-1 font-medium">Home</div>
            {cats.map((c) => {
              const list = tabs.filter((t) => t.category === c);
              if (!list.length) return null;
              return (
                <div key={c}>
                  <p className="px-1.5 pt-1.5 text-[8.5px] font-semibold uppercase tracking-wider text-faint">{c}</p>
                  {list.slice(0, 6).map((t) => (
                    <div key={t.name} className="flex items-center gap-1.5 truncate px-1.5 py-0.5 text-fg/85">
                      <ModuleIcon name={t.icon} className="size-3 shrink-0 text-muted" /> {t.name}
                    </div>
                  ))}
                  {list.length > 6 && <p className="px-1.5 text-faint">+{list.length - 6} more</p>}
                </div>
              );
            })}
          </div>
          <div className="min-w-0 flex-1 space-y-2 p-3">
            <p className="text-[14px] font-semibold">Good afternoon, Sam</p>
            <div className="flex gap-1">
              {teams.map((t) => (
                <span key={t.name} className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5">
                  <span className="size-1.5 rounded-full" style={{ background: t.color }} />
                  {t.name || 'Team'}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['Up next', 'Your tasks', 'Attendance', 'Team tools'].map((w) => (
                <div key={w} className="rounded-lg border border-border bg-surface p-2 shadow-sm">
                  <p className="font-semibold">{w}</p>
                  <div className="mt-1.5 h-1.5 w-3/4 rounded bg-bg-subtle" />
                  <div className="mt-1 h-1.5 w-1/2 rounded bg-bg-subtle" />
                </div>
              ))}
            </div>
            <button type="button" className="rounded-md bg-accent px-2 py-1 font-medium text-accent-fg">
              Primary action
            </button>
            <p>
              <span className="font-medium text-accent">A link in your accent</span>
            </p>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[11px] text-faint">Live preview · text on accent {readableOn(a.accent) === '#FFFFFF' ? 'white' : 'dark'}</p>
    </div>
  );
}
