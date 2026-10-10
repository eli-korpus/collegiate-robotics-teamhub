import { z } from 'zod';

/** The three base profile types (spec §7.2). Admin is a flag, not a type. */
import { EMAIL_DOMAIN_RE, PROFILE_TYPES } from './util';
export * from './util';
export const ProfileTypeSchema = z.enum(PROFILE_TYPES);

export const MODULE_CATEGORIES = ['team', 'engineering', 'competition', 'outreach'] as const;
export type ModuleCategory = (typeof MODULE_CATEGORIES)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color like #3B82F6');
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Must be a UUID');
const slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'Lowercase letters, numbers, - and _ only');

export const TeamSchema = z.object({
  id: uuid,
  number: z.number().int().positive().nullable(),
  name: z.string().min(1).max(80),
  shortCode: z.string().regex(/^[A-Za-z0-9]{1,4}$/, '1–4 letters or digits'),
  color: hexColor,
  logo: z.string().nullable().default(null),
  logoDark: z.string().nullable().default(null),
  school: z.string().nullable().default(null),
  city: z.string().nullable().default(null),
});
export type TeamConfig = z.infer<typeof TeamSchema>;

export const PositionSchema = z.object({
  id: z.string().regex(/^pos_[a-z0-9_]+$/, 'Position ids look like pos_lead_programmer'),
  name: z.string().min(1).max(60),
  /** Older configs could tie a position to one team; the wizard now offers whole program or each team instead. */
  teamId: uuid.nullable().default(null),
  /** Each team has its own holder(s), who only act for their team. False: one position for the whole program. */
  perTeam: z.boolean().default(false),
  grantsPermissions: z.boolean().default(false),
});
export type PositionConfig = z.infer<typeof PositionSchema>;

export const SubteamSchema = z.object({ id: slug, name: z.string().min(1).max(40) });
export type SubteamConfig = z.infer<typeof SubteamSchema>;

/** Extended profile fields (spec §7, §12.2). Kept to simple text/select so they can be edited inline. */
export const ProfileFieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().min(1).max(60),
  type: z.enum(['text', 'select', 'multiselect']),
  options: z.array(z.string()).default([]),
  /** Older setting: true = mentors only. Use `visibility`. */
  private: z.boolean().default(false),
  /** Who can see it: everyone in the program, team leaders (captains and mentors) or mentors only. */
  visibility: z.enum(['everyone', 'leaders', 'mentors']).optional(),
  /** Who is asked to fill it in (e.g. members and captains for shirt sizes). Missing = everyone. */
  askTypes: z.array(ProfileTypeSchema).optional(),
});
export type ProfileFieldConfig = z.infer<typeof ProfileFieldSchema>;

export const PermissionGrantSchema = z.object({
  types: z.array(ProfileTypeSchema).default([]),
  positions: z.array(z.string()).default([]),
});
export type PermissionGrant = z.infer<typeof PermissionGrantSchema>;

export const ModuleStateSchema = z.enum(['active', 'dormant']);
export type ModuleState = z.infer<typeof ModuleStateSchema>;

export const ModuleEntrySchema = z.object({
  state: ModuleStateSchema.default('active'),
  settings: z.record(z.string(), z.unknown()).default({}),
});
export type ModuleEntry = z.infer<typeof ModuleEntrySchema>;

export const TOOL_LINK_SLOTS = [
  'team_chat',
  'portfolio',
  'code_repo',
  'cad',
  'drive',
  'website',
  'social',
  'ftcscout',
  'manual',
  'gm0',
  'ftc_docs',
  'qa_forum',
  'scouting_sheet',
  'printer_dashboard',
  'outreach_doc',
  'sdk_docs',
  'other',
] as const;
export type ToolLinkSlot = (typeof TOOL_LINK_SLOTS)[number];

export const ToolLinkSchema = z.object({
  slot: z.string().nullable().default(null),
  /** A team's own link (programs with several teams); null = the whole program. */
  teamId: uuid.nullable().default(null),
  label: z.string().min(1).max(60),
  url: z.string().url(),
  section: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
});
export type ToolLinkConfig = z.infer<typeof ToolLinkSchema>;

export const HOSTS = ['cloudflare', 'vercel', 'netlify', 'github-pages'] as const;
export type HostProvider = (typeof HOSTS)[number];

export const ConfigSchema = z.object({
  $schema: z.string().optional(),
  configVersion: z.literal(1).default(1),
  program: z.object({
    name: z.string().min(1).max(80),
    logo: z.string().nullable().default(null),
    multiTeam: z.boolean().default(false),
  }),
  teams: z.array(TeamSchema).min(1, 'Add at least one team'),
  theme: z
    .object({
      accent: hexColor.default('#3B82F6'),
      secondary: hexColor.nullable().default(null),
      corners: z.enum(['soft', 'sharp']).default('soft'),
      defaultMode: z.enum(['light', 'dark', 'system']).default('system'),
    })
    .default({ accent: '#3B82F6', secondary: null, corners: 'soft', defaultMode: 'system' }),
  /** Initial season label. The live value lives in teamhub_settings and is editable in Admin. */
  season: z.string().regex(/^\d{4}[–-]\d{2}$/, 'Season labels look like 2026–27'),
  modules: z.record(z.string(), ModuleEntrySchema).default({}),
  subteams: z.array(SubteamSchema).default([]),
  positions: z.array(PositionSchema).default([]),
  profileFields: z.array(ProfileFieldSchema).default([]),
  permissions: z.record(z.string(), PermissionGrantSchema).default({}),
  home: z
    .object({
      defaults: z.record(ProfileTypeSchema, z.array(z.string())).default({ member: [], captain: [], mentor: [] }),
    })
    .default({ defaults: { member: [], captain: [], mentor: [] } }),
  nav: z.object({ order: z.array(z.string()).default([]) }).default({ order: [] }),
  toolLinks: z.array(ToolLinkSchema).default([]),
  /**
   * Optional sign-up rule: only emails from these domains (or their subdomains) can create an account. The live value
   * is in teamhub_settings, editable in Admin > Who can join; the wizard writes it when you change it here.
   */
  join: z
    .object({ allowedEmailDomains: z.array(z.string().regex(EMAIL_DOMAIN_RE, 'Use a domain like yourschool.org')).max(20).default([]) })
    .default({ allowedEmailDomains: [] }),
  hosting: z
    .object({
      provider: z.enum(HOSTS).nullable().default(null),
      url: z.string().url().nullable().default(null),
      basePath: z.string().default('/'),
    })
    .default({ provider: null, url: null, basePath: '/' }),
  supabase: z
    .object({
      url: z.string().url().nullable().default(null),
      anonKey: z.string().nullable().default(null),
      projectRef: z.string().nullable().default(null),
    })
    .default({ url: null, anonKey: null, projectRef: null }),
  features: z.object({ email: z.boolean().default(false) }).default({ email: false }),
});

export type TeamhubConfig = z.infer<typeof ConfigSchema>;
export type TeamhubConfigInput = z.input<typeof ConfigSchema>;

export interface ConfigIssue {
  path: string;
  message: string;
}

/**
 * Older configs may list tabs that became part of the core. Bulletin Board (1.1.1) is now the Links page: drop the tab
 * and carry over who could add and manage its links (core.add_links / core.edit_links), so nobody loses access.
 */
export function upgradeConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const c = raw as { modules?: Record<string, unknown>; permissions?: Record<string, { types?: string[]; positions?: string[] }>; nav?: { order?: unknown } };
  if (!c.modules || !('bulletin' in c.modules)) return raw;
  const { bulletin: _retired, ...modules } = c.modules;
  const perms = { ...(c.permissions ?? {}) };
  const union = (a: { types?: string[]; positions?: string[] }, b: { types?: string[]; positions?: string[] }) => ({
    types: [...new Set([...(a.types ?? []), ...(b.types ?? [])])],
    positions: [...new Set([...(a.positions ?? []), ...(b.positions ?? [])])],
  });
  const post = perms['bulletin.post'] ?? { types: ['captain', 'mentor'], positions: [] };
  const manage = perms['bulletin.manage'] ?? { types: ['mentor'], positions: [] };
  perms['core.add_links'] = perms['core.add_links'] ? union(perms['core.add_links'], post) : union(post, {});
  perms['core.edit_links'] = union(perms['core.edit_links'] ?? { types: ['mentor'], positions: [] }, manage);
  for (const k of ['bulletin.view', 'bulletin.post', 'bulletin.manage']) delete perms[k];
  const order = Array.isArray(c.nav?.order) ? (c.nav.order as unknown[]).filter((id) => id !== 'bulletin') : undefined;
  return { ...c, modules, permissions: perms, ...(order ? { nav: { ...c.nav, order } } : {}) };
}

export function parseConfig(raw: unknown): { ok: true; config: TeamhubConfig } | { ok: false; issues: ConfigIssue[] } {
  const result = ConfigSchema.safeParse(upgradeConfig(raw));
  if (result.success) {
    const extra = crossValidate(result.data);
    if (extra.length) return { ok: false, issues: extra };
    return { ok: true, config: result.data };
  }
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  };
}

/** Rules a plain zod object cannot express (unique ids, references between lists). */
function crossValidate(c: TeamhubConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const dup = (list: string[], path: string) => {
    const seen = new Set<string>();
    for (const v of list) {
      if (seen.has(v)) issues.push({ path, message: `Duplicate value "${v}"` });
      seen.add(v);
    }
  };
  dup(c.teams.map((t) => t.id), 'teams');
  dup(c.teams.map((t) => t.shortCode.toUpperCase()), 'teams.shortCode');
  dup(c.positions.map((p) => p.id), 'positions');
  dup(c.subteams.map((s) => s.id), 'subteams');
  dup(c.profileFields.map((f) => f.id), 'profileFields');
  const teamIds = new Set(c.teams.map((t) => t.id));
  c.positions.forEach((p, i) => {
    if (p.teamId && !teamIds.has(p.teamId)) issues.push({ path: `positions.${i}.teamId`, message: 'Unknown team' });
  });
  const positionIds = new Set(c.positions.map((p) => p.id));
  for (const [key, grant] of Object.entries(c.permissions)) {
    for (const pid of grant.positions) {
      if (!positionIds.has(pid)) issues.push({ path: `permissions.${key}`, message: `Unknown position "${pid}"` });
    }
  }
  if (!c.program.multiTeam && c.teams.length > 1) {
    issues.push({ path: 'program.multiTeam', message: 'Single-team programs can only have one team' });
  }
  return issues;
}
