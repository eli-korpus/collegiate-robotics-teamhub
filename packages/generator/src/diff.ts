import type { TeamhubConfig } from '@teamhub/config-schema';
import type { Catalog } from './catalog';
import { resolveConfig } from './resolve';

export interface DiffLine {
  kind: '+' | '-' | '~';
  text: string;
  detail?: string;
  /** Set for removed tabs: the wizard must ask "keep dormant" vs "delete". */
  removedModule?: string;
}

const tablesIn = (sql: string) => (sql.replace(/--.*$/gm, '').match(/create table/gi) ?? []).length;

/** Human-readable change list shown before applying an Edit (spec §5.3). */
export function diffConfigs(before: TeamhubConfig, after: TeamhubConfig, catalog: Catalog): DiffLine[] {
  const out: DiffLine[] = [];
  const name = (id: string) => catalog.modules.get(id)?.manifest.name ?? id;
  const ra = resolveConfig(before, catalog);
  const rb = resolveConfig(after, catalog);

  for (const [id, entry] of Object.entries(after.modules)) {
    const prev = before.modules[id];
    const cm = catalog.modules.get(id);
    if (!cm) continue;
    if (!prev) {
      const t = cm.migrations.reduce((n, m) => n + tablesIn(m.sql), 0);
      const b = cm.manifest.buckets.length;
      const parts = [t && `creates ${t} table${t === 1 ? '' : 's'}`, b && `${b} storage bucket${b === 1 ? '' : 's'}`].filter(Boolean);
      out.push({ kind: '+', text: `Add tab: ${cm.manifest.name}`, detail: parts.join(', ') || 'no new tables' });
    } else if (prev.state !== entry.state) {
      out.push({
        kind: '~',
        text: entry.state === 'dormant' ? `Hide tab (keep data): ${cm.manifest.name}` : `Restore dormant tab: ${cm.manifest.name}`,
      });
    } else if (JSON.stringify(prev.settings) !== JSON.stringify(entry.settings)) {
      out.push({ kind: '~', text: `Settings: ${cm.manifest.name}` });
    }
  }
  for (const id of Object.keys(before.modules)) {
    if (!after.modules[id]) {
      out.push({ kind: '-', text: `Remove tab: ${name(id)}`, detail: "you'll choose what happens to its data", removedModule: id });
    }
  }

  const ixBefore = new Set(ra.installedIntegrations.map((i) => i.manifest.id));
  const ixAfter = new Set(rb.installedIntegrations.map((i) => i.manifest.id));
  for (const ix of rb.installedIntegrations) {
    if (!ixBefore.has(ix.manifest.id)) out.push({ kind: '+', text: `Integration: ${ix.manifest.id}`, detail: ix.manifest.summary });
  }
  for (const ix of ra.installedIntegrations) {
    if (!ixAfter.has(ix.manifest.id)) out.push({ kind: '-', text: `Integration: ${ix.manifest.id}`, detail: 'its links between tabs are removed' });
  }

  const label = (k: string) => rb.permissionDefs[k]?.label ?? ra.permissionDefs[k]?.label ?? k;
  for (const k of Object.keys(rb.matrix)) {
    const a = ra.matrix[k];
    const b = rb.matrix[k];
    if (!a) continue;
    const add = [...b.types.filter((t) => !a.types.includes(t)), ...b.positions.filter((p) => !a.positions.includes(p))];
    const rem = [...a.types.filter((t) => !b.types.includes(t)), ...a.positions.filter((p) => !b.positions.includes(p))];
    if (add.length || rem.length) {
      const fmt = (xs: string[], s: string) => xs.map((x) => s + x.replace(/^pos_/, '').replace(/^./, (c) => c.toUpperCase())).join(' ');
      out.push({ kind: '~', text: `Permissions: ${k}`, detail: `${label(k)} ${[fmt(add, '+'), fmt(rem, '−')].filter(Boolean).join(' ')}` });
    }
  }

  for (const t of after.teams) {
    const p = before.teams.find((x) => x.id === t.id);
    if (!p) out.push({ kind: '+', text: `Team: ${t.name}` });
    else {
      if (p.color !== t.color) out.push({ kind: '~', text: `${t.name} color: ${p.color} → ${t.color}` });
      if (p.name !== t.name) out.push({ kind: '~', text: `Team name: ${p.name} → ${t.name}` });
      if (p.logo !== t.logo) out.push({ kind: '~', text: `${t.name} logo updated` });
    }
  }
  for (const t of before.teams) {
    if (!after.teams.find((x) => x.id === t.id)) out.push({ kind: '-', text: `Team: ${t.name}`, detail: 'archived; its data is kept' });
  }
  if (before.theme.accent !== after.theme.accent) out.push({ kind: '~', text: `Accent: ${before.theme.accent} → ${after.theme.accent}` });
  if (before.theme.corners !== after.theme.corners || before.theme.defaultMode !== after.theme.defaultMode)
    out.push({ kind: '~', text: 'Look & feel updated' });
  if (before.program.name !== after.program.name) out.push({ kind: '~', text: `Program name: ${before.program.name} → ${after.program.name}` });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join(',');
  if (ids(before.positions) !== ids(after.positions) || JSON.stringify(before.positions) !== JSON.stringify(after.positions))
    out.push({ kind: '~', text: 'Positions updated' });
  if (JSON.stringify(before.subteams) !== JSON.stringify(after.subteams)) out.push({ kind: '~', text: 'Subteams updated' });
  if (JSON.stringify(before.profileFields) !== JSON.stringify(after.profileFields)) out.push({ kind: '~', text: 'Profile fields updated' });
  if (JSON.stringify(before.home) !== JSON.stringify(after.home)) out.push({ kind: '~', text: 'Home widget defaults updated' });
  return out;
}
