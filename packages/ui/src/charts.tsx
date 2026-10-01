/** Hand-rolled SVG charts (spec §3.1: avoid heavy chart libraries). */
import type { ReactNode } from 'react';
import { cn } from './cn';

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
  className,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
  children?: ReactNode;
}) {
  const tones = { default: 'text-fg', success: 'text-success', warning: 'text-warning', danger: 'text-danger' };
  return (
    <div className={cn('rounded-lg border border-border bg-surface p-3.5 shadow-sm', className)}>
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
        {icon && <span className="[&>svg]:size-3.5">{icon}</span>}
        {label}
      </div>
      <div className={cn('tabular mt-1 text-[22px] font-semibold tracking-tight', tones[tone ?? 'default'])}>{value}</div>
      {hint && <div className="text-[12px] text-muted">{hint}</div>}
      {children}
    </div>
  );
}

export function Sparkline({
  values,
  width = 120,
  height = 32,
  className,
  stroke = 'var(--accent)',
  fill = true,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  stroke?: string;
  fill?: boolean;
  label?: string;
}) {
  if (values.length < 2) return <svg width={width} height={height} className={className} role="img" aria-label={label ?? 'Not enough data'} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 2) + 1, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label={label ?? `Trend: ${values.join(', ')}`}>
      {fill && <path d={`${d} L${width - 1},${height} L1,${height} Z`} fill={stroke} opacity={0.12} />}
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={stroke} />
    </svg>
  );
}

export function MiniBarChart({
  data,
  height = 120,
  className,
  format = (n) => String(n),
}: {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn('flex items-end gap-1.5', className)} style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(', ')}>
      {data.map((d, i) => (
        <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${d.label}: ${format(d.value)}`}>
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-[4px] transition-all" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value ? 2 : 0, background: d.color ?? 'var(--accent)' }} />
          </div>
          <span className="w-full truncate text-center text-[10.5px] text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal stacked bar with legend (storage by module). */
export function StackedBar({
  segments,
  total,
  format = (n) => String(n),
}: {
  segments: { label: string; value: number; color: string }[];
  total?: number;
  format?: (n: number) => string;
}) {
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0);
  const shown = segments.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-subtle" role="img" aria-label={shown.map((s) => `${s.label} ${format(s.value)}`).join(', ')}>
        {shown.map((s) => (
          <div key={s.label} style={{ width: `${(s.value / (sum || 1)) * 100}%`, background: s.color }} title={`${s.label}: ${format(s.value)}`} />
        ))}
      </div>
      <ul className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
        {shown.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <span className="tabular text-muted">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  label,
  color = 'var(--accent)',
  children,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  label?: string;
  color?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(v * 100)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-subtle)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - v)} strokeLinecap="round" />
      </svg>
      <span className="tabular absolute text-[12.5px] font-semibold">{children ?? `${Math.round(v * 100)}%`}</span>
    </span>
  );
}

/** Usage meter with 70%/90% warning colors (spec §11.4). */
export function Meter({ value, max, label, format = (n) => String(n) }: { value: number; max: number; label: ReactNode; format?: (n: number) => string }) {
  const pct = max ? value / max : 0;
  const color = pct >= 0.9 ? 'var(--danger)' : pct >= 0.7 ? 'var(--warning)' : 'var(--accent)';
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted">
          {format(value)} of {format(max)} · <span style={{ color }}>{Math.round(pct * 100)}%</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-subtle" role="meter" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, pct * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Multi-series line chart (driver practice scores, results trends). */
export function LineChart({
  series,
  height = 180,
  xLabels,
}: {
  series: { label: string; color: string; values: (number | null)[] }[];
  height?: number;
  xLabels?: string[];
}) {
  const width = 600;
  const pad = { l: 34, r: 8, t: 8, b: xLabels ? 20 : 8 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!all.length) return <p className="py-6 text-center text-[13px] text-faint">No data yet</p>;
  const n = Math.max(...series.map((s) => s.values.length));
  const min = Math.min(0, ...all);
  const max = Math.max(...all) || 1;
  const x = (i: number) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (width - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (height - pad.t - pad.b);
  const ticks = [min, (min + max) / 2, max];
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join(', ')}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--text-faint)">
              {Math.round(t)}
            </text>
          </g>
        ))}
        {xLabels?.map((l, i) =>
          i % Math.ceil(xLabels.length / 8) === 0 ? (
            <text key={i} x={x(i)} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--text-faint)">
              {l}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v == null ? null : ([x(i), y(v)] as const))).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.label}>
              <path d={pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a},${b}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {pts.map(([a, b], i) => (
                <circle key={i} cx={a} cy={b} r={2.5} fill={s.color} />
              ))}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <div className="mt-1 flex flex-wrap gap-3 text-[12px] text-muted">
          {series.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#A855F7'];

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
