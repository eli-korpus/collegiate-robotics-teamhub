import { useModuleSettings, useRows } from '@teamhub/sdk';

export interface Matrix {
  criteria: { name: string; weight: number }[];
  options: { name: string; scores: number[] }[];
}

export interface Entry {
  id: string;
  team_id: string | null;
  kind: 'log' | 'iteration';
  date: string;
  title: string;
  body: string;
  subsystem_id: string | null;
  version_label: string | null;
  why: string | null;
  onshape_url: string | null;
  decision_matrix: Matrix | null;
  tags: string[];
  authors: string[];
  season: string;
  refs: string[];
  created_by: string | null;
  created_at: string;
}

export interface Subsystem {
  id: string;
  team_id: string | null;
  name: string;
  sort: number;
}

export interface NbImage {
  id: string;
  entry_id: string;
  path: string;
  caption: string | null;
  sort: number;
}

export const useEntries = () => useRows<Entry>(['notebook', 'entries'], (sb) => sb.from('nb_entries').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }));
export const useSubsystems = () => useRows<Subsystem>(['notebook', 'subsystems'], (sb) => sb.from('nb_subsystems').select('*').order('sort').order('name'));
export const useImages = (entryIds: string[]) =>
  useRows<NbImage>(['notebook', 'images', entryIds.join(',')], (sb) => sb.from('nb_images').select('*').in('entry_id', entryIds).order('sort'), { enabled: entryIds.length > 0 });

export const useNbSettings = () => useModuleSettings<{ tags: string[]; maxPhotos: number }>('notebook');

export function matrixTotals(m: Matrix): number[] {
  return m.options.map((o) => m.criteria.reduce((s, c, i) => s + (o.scores[i] ?? 0) * (c.weight || 0), 0));
}

/** Markdown export for building the portfolio (spec §13.10). */
export function toMarkdown(entries: Entry[], subsystems: Subsystem[], names: Map<string, string>): string {
  const sub = (id: string | null) => subsystems.find((s) => s.id === id)?.name;
  return entries
    .map((e) => {
      const lines = [`## ${e.title}`, '', `*${e.date}* · ${e.kind === 'iteration' ? `Design iteration${e.version_label ? ` ${e.version_label}` : ''}` : 'Log'}${sub(e.subsystem_id) ? ` · ${sub(e.subsystem_id)}` : ''}`];
      if (e.authors.length) lines.push(`Authors: ${e.authors.map((a) => names.get(a) ?? 'Former member').join(', ')}`);
      if (e.tags.length) lines.push(`Tags: ${e.tags.join(', ')}`);
      lines.push('', e.body);
      if (e.why) lines.push('', '**Why:**', e.why);
      if (e.onshape_url) lines.push('', `Onshape: ${e.onshape_url}`);
      if (e.decision_matrix?.options.length) {
        const m = e.decision_matrix;
        const totals = matrixTotals(m);
        lines.push('', `| Option | ${m.criteria.map((c) => `${c.name} (×${c.weight})`).join(' | ')} | Total |`, `|---|${m.criteria.map(() => '---').join('|')}|---|`);
        m.options.forEach((o, i) => lines.push(`| ${o.name} | ${o.scores.join(' | ')} | ${totals[i]} |`));
      }
      return lines.join('\n');
    })
    .join('\n\n---\n\n');
}
