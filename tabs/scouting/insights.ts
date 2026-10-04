/**
 * Scouting insights: pure functions combining FTCScout match data with your own scouting entries.
 * Nothing here is game-specific: numeric fields are whatever your team defined this season.
 */
import type { FieldDef, FormValues } from '@teamhub/ui';
import type { FtcMatch } from '@teamhub/sdk/ftcscout';

export interface MatchPoint {
  matchId: number;
  label: string;
  score: number;
  opp: number;
  won: boolean | null;
}

const label = (m: FtcMatch) => (m.tournamentLevel === 'Quals' ? `Q${m.matchNum}` : m.description || `${m.tournamentLevel} ${m.series}-${m.matchNum}`);

/** Alliance scores (no penalties) for every played match of a team, in order. */
export function matchHistory(matches: FtcMatch[], team: number): MatchPoint[] {
  return matches
    .filter((m) => m.hasBeenPlayed && m.scores && m.teams.some((t) => t.teamNumber === team))
    .sort((a, b) => a.id - b.id)
    .map((m) => {
      const side = m.teams.find((t) => t.teamNumber === team)!.alliance === 'Blue' ? 'blue' : 'red';
      const other = side === 'red' ? 'blue' : 'red';
      const score = m.scores?.[side]?.totalPointsNp ?? 0;
      const opp = m.scores?.[other]?.totalPointsNp ?? 0;
      return { matchId: m.id, label: label(m), score, opp, won: score === opp ? null : score > opp };
    });
}

export function mean(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
export function stdev(xs: number[]): number | null {
  const m = mean(xs);
  if (m == null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}
/** Least-squares slope per match: positive = improving through the event. */
export function trend(xs: number[]): number | null {
  if (xs.length < 3) return null;
  const n = xs.length;
  const mx = (n - 1) / 2;
  const my = mean(xs)!;
  let num = 0;
  let den = 0;
  xs.forEach((y, i) => {
    num += (i - mx) * (y - my);
    den += (i - mx) ** 2;
  });
  return den ? num / den : 0;
}

const NUMERIC = new Set(['counter', 'number', 'rating', 'timer']);
export const isNumericField = (f: FieldDef) => NUMERIC.has(f.type) || f.type === 'checkbox';

/** Average per numeric field (checkboxes as 0–1). */
export function fieldAverages(fields: FieldDef[], data: FormValues[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fields.filter(isNumericField)) {
    const vals = data.map((d) => d[f.id]).filter((v) => v !== null && v !== undefined && v !== '').map((v) => (typeof v === 'boolean' ? (v ? 1 : 0) : Number(v))).filter((n) => !Number.isNaN(n));
    const m = mean(vals);
    if (m != null) out[f.id] = m;
  }
  return out;
}

export interface Highlight {
  fieldId: string;
  label: string;
  team: number;
  event: number;
  ratio: number;
}

/** Fields where a team is clearly above (strengths) or below (weaknesses) the event average. */
export function highlights(fields: FieldDef[], team: Record<string, number>, event: Record<string, number>): { strengths: Highlight[]; weaknesses: Highlight[] } {
  const hs: Highlight[] = [];
  for (const f of fields.filter(isNumericField)) {
    const t = team[f.id];
    const e = event[f.id];
    if (t == null || e == null || e === 0) continue;
    hs.push({ fieldId: f.id, label: f.label, team: t, event: e, ratio: t / e });
  }
  return {
    strengths: hs.filter((h) => h.ratio >= 1.25).sort((a, b) => b.ratio - a.ratio),
    weaknesses: hs.filter((h) => h.ratio <= 0.75).sort((a, b) => a.ratio - b.ratio),
  };
}

/**
 * Data-driven pick score: average of z-scores across OPR and every numeric scouted field (higher = better).
 * Only teams with data for a metric contribute to that metric. Returns null when a team has no data.
 */
export function compositeScores(rows: { team: number; opr: number | null; fields: Record<string, number> }[], fieldIds: string[]): Map<number, number | null> {
  const metrics: ((r: (typeof rows)[number]) => number | null | undefined)[] = [(r) => r.opr, ...fieldIds.map((id) => (r: (typeof rows)[number]) => r.fields[id])];
  const z = metrics.map((get) => {
    const vals = rows.map(get).filter((v): v is number => v != null);
    const m = mean(vals);
    const s = stdev(vals);
    return (r: (typeof rows)[number]) => {
      const v = get(r);
      return v == null || m == null || !s ? null : (v - m) / s;
    };
  });
  return new Map(
    rows.map((r) => {
      const zs = z.map((f) => f(r)).filter((v): v is number => v != null);
      return [r.team, zs.length ? mean(zs) : null];
    }),
  );
}

export interface Coverage {
  unscouted: number[];
  upcoming: { label: string; teams: number[] }[];
}

/** Which teams nobody has scouted yet, and the next unplayed matches they're in. */
export function coverage(teams: number[], scoutedCounts: Map<number, number>, matches: FtcMatch[], exclude?: number | null): Coverage {
  const unscouted = teams.filter((t) => t !== exclude && !(scoutedCounts.get(t) ?? 0)).sort((a, b) => a - b);
  const set = new Set(unscouted);
  const upcoming = matches
    .filter((m) => !m.hasBeenPlayed)
    .sort((a, b) => a.id - b.id)
    .map((m) => ({ label: label(m), teams: m.teams.map((t) => t.teamNumber).filter((t) => set.has(t)) }))
    .filter((m) => m.teams.length)
    .slice(0, 6);
  return { unscouted, upcoming };
}
