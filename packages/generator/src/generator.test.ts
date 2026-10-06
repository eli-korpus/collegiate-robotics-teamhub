import { describe, expect, it } from 'vitest';
import { parseConfig } from '@teamhub/config-schema';
import { compileFunctions, describePlan, diffConfigs, generateDashboardFiles, loadCatalog, planSql, resolveConfig, themeCss } from './index';

const cfg = (extra: Record<string, unknown> = {}) => {
  const r = parseConfig({
    program: { name: 'Gen Test', multiTeam: true },
    teams: [
      { id: '11111111-1111-4111-8111-111111111111', number: 1, name: 'A', shortCode: 'A', color: '#3366FF' },
      { id: '22222222-2222-4222-8222-222222222222', number: 2, name: 'B', shortCode: 'B', color: '#FACC15' },
    ],
    season: '2026–27',
    positions: [{ id: 'pos_lead', name: 'Lead', grantsPermissions: true }],
    ...extra,
  });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.config;
};

describe('generator', async () => {
  const catalog = await loadCatalog();

  it('compiles the permission matrix into SQL (no permission rows)', () => {
    const r = resolveConfig(cfg({ permissions: { 'people.approve_members': { types: ['mentor'], positions: ['pos_lead'] } } }), catalog);
    const sql = compileFunctions(r);
    expect(sql).toContain(`when 'people.approve_members' then teamhub_has_type(p_team, array['mentor']::text[]) or teamhub_has_position(p_team, array['pos_lead']::text[])`);
    expect(sql).toContain('create or replace function teamhub_users_with');
  });

  it('plans a fresh install and an idempotent re-apply', () => {
    const r = resolveConfig(cfg(), catalog);
    const fresh = planSql(r, null);
    expect(fresh.summary.migrations[0]).toEqual({ id: 'core', from: 0, to: catalog.core.version });
    expect(describePlan(fresh).join(' ')).toContain('table');
    const again = planSql(r, { versions: { core: { version: catalog.core.version, state: 'active' } } });
    expect(again.summary.migrations).toEqual([]);
  });

  it('generates only enabled modules and a theme with team colors', () => {
    const r = resolveConfig(cfg(), catalog);
    const files = generateDashboardFiles(r);
    const mods = files.find((f) => f.path.endsWith('modules.ts'))!.content;
    expect(mods).not.toContain('import c0');
    const css = themeCss(r);
    expect(css.css).toContain('--team-a:');
    expect(css.css).toContain('--team-b:');
  });

  it('diffs configs in human terms', () => {
    const a = cfg();
    const b = cfg({ theme: { accent: '#10B981' } });
    b.teams[1].color = '#000000';
    const d = diffConfigs(a, b, catalog);
    expect(d.map((x) => x.text)).toEqual(expect.arrayContaining(['Accent: #3B82F6 to #10B981', 'B color: #FACC15 to #000000']));
  });

  it('lists a new program logo (and the browser-tab icon made from it) in the changes', () => {
    const a = cfg();
    const b = cfg();
    a.program.logo = 'branding/program.webp?v=1';
    b.program.logo = 'branding/program.webp?v=2';
    expect(diffConfigs(a, b, catalog).map((x) => x.text)).toContain('Program logo and browser-tab icon updated');
  });
});
