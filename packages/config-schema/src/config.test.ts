import { describe, expect, it } from 'vitest';
import { ConfigSchema, parseConfig, seasonYear, defaultSeasonLabel } from './index';

const base = {
  program: { name: 'P', multiTeam: false },
  teams: [{ id: '11111111-1111-4111-8111-111111111111', number: 1, name: 'A', shortCode: 'A', color: '#112233' }],
  season: '2026–27',
};

describe('config schema', () => {
  it('fills defaults and round-trips through JSON', () => {
    const r = parseConfig(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const again = parseConfig(JSON.parse(JSON.stringify(r.config)));
    expect(again.ok && again.config).toEqual(r.config);
    expect(r.config.theme.accent).toBe('#3B82F6');
    expect(r.config.features.email).toBe(false);
  });
  it('rejects duplicate team codes and multi-team mismatch', () => {
    const r = parseConfig({ ...base, teams: [base.teams[0], { ...base.teams[0], id: '22222222-2222-4222-8222-222222222222' }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.path)).toEqual(expect.arrayContaining(['teams.shortCode', 'program.multiTeam']));
  });
  it('validates permission positions exist', () => {
    const r = parseConfig({ ...base, permissions: { 'x.y': { types: ['mentor'], positions: ['pos_nope'] } } });
    expect(r.ok).toBe(false);
  });
  it('derives FTCScout seasons from labels', () => {
    expect(seasonYear('2026–27')).toBe(2026);
    expect(defaultSeasonLabel(new Date(2026, 9, 1))).toBe('2026–27');
    expect(defaultSeasonLabel(new Date(2027, 2, 1))).toBe('2026–27');
  });
  it('exposes a JSON-schema-able zod object', () => {
    expect(ConfigSchema.shape.teams).toBeDefined();
  });
});
