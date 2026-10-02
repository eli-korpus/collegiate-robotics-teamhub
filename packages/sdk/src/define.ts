/**
 * Pure, React-free manifest definitions. Imported by the generator (Node), the wizard and the dashboard.
 * A module's `module.ts` must only import from this file and zod so it can be loaded anywhere.
 */
import type { z } from 'zod';
import type { ModuleCategory, ProfileType, TeamhubConfig } from '@teamhub/config-schema';

export interface PermissionDef {
  label: string;
  default: ProfileType[];
  /** Position ids suggested as defaults in the wizard (only applied if the position exists). */
  positions?: string[];
  /** Shown in the wizard's simple view. */
  simple?: boolean;
  group?: string;
}
export type PermissionDefs = Record<string, PermissionDef & { key: string; module: string }>;

export function definePermissions<const K extends string>(
  moduleId: string,
  defs: Record<K, PermissionDef>,
): Record<`${string}.${K}`, PermissionDef & { key: string; module: string }> {
  const out: Record<string, PermissionDef & { key: string; module: string }> = {};
  for (const [action, def] of Object.entries(defs) as [string, PermissionDef][]) {
    const key = `${moduleId}.${action}`;
    out[key] = { ...def, key, module: moduleId };
  }
  return out as any;
}

export interface NotForEntry {
  text: string;
  /** Module id, `link:<slot>` (tool link) or `core:<page>` (e.g. core:request-info). */
  goTo: string;
}

export interface BucketDef {
  id: string;
  public: boolean;
  maxFileMB: number;
  mime: string[];
  /** Permission key needed to upload (besides being an active member). */
  uploadPerm: string;
  /** Permission key that allows deleting anyone's files. Owners can always delete their own. */
  deleteAnyPerm: string;
}

export interface ModuleManifest<S extends z.ZodType = z.ZodType> {
  id: string;
  /** Table/function/policy prefix, e.g. `att_`. Empty string for modules with no tables. */
  prefix: string;
  name: string;
  category: ModuleCategory;
  /** lucide icon name (resolved by the client file) */
  icon: string;
  summary: string;
  purpose: string;
  notFor: NotForEntry[];
  /** Human estimate shown in the wizard tab picker. */
  footprint: string;
  usesFiles?: boolean;
  /** What it stores, shown in the wizard. */
  stores: string;
  settings: S;
  permissions: PermissionDefs;
  /** Extra permissions computed from settings (e.g. To Manufacture's manage_<method>). */
  dynamicPermissions?: (settings: z.infer<S>, config: TeamhubConfig) => PermissionDefs;
  suggestedPositions: string[];
  entities: string[];
  buckets: BucketDef[];
  toolLinkSlots: string[];
  /** Hide the whole tab (sidebar, ⌘K) from people without this permission in any team, e.g. Sponsors CRM. RLS still does the real protecting. */
  viewPerm?: string;
  /** Widget ids (client file provides the components). Used for Home default ordering in the wizard. */
  widgets: { id: string; title: string; defaultFor: ProfileType[] }[];
  /** Ids of entities that accept comments (e.g. `task`); generator compiles teamhub_ref_visible() for them. */
  commentEntities?: string[];
  /** SQL expression templates for comment visibility: `{id}` is replaced by the entity id text. */
  refVisibility?: Record<string, string>;
  /** Tables exported by Backup & Export, in dependency order. */
  exportTables: string[];
  /** SQL run by the wizard's New Season tool (receives `:old` and `:new` labels). Optional. */
  seasonRollover?: { describe: string; sql: string };
  /** Module whose presence this module reads in UI only (never required). */
  docs?: string;
  /** Edge functions (folders in supabase/functions) deployed only when this module is enabled. */
  functions?: string[];
}

export function defineModule<S extends z.ZodType>(m: ModuleManifest<S>): ModuleManifest<S> {
  return m;
}

export interface IntegrationManifest {
  id: string; // 'attendance+calendar'
  requires: string[];
  summary: string;
  /** Prefix for any functions/columns this integration owns, e.g. `ix_attcal_`. */
  prefix: string;
  /** SQL to tear down (runs when one side is removed). Must only touch the integration's own objects. */
  down: string;
}

export function defineIntegration(m: IntegrationManifest): IntegrationManifest {
  return m;
}

/** All permission keys for a module given its settings. */
export function modulePermissions(m: ModuleManifest, settings: unknown, config: TeamhubConfig): PermissionDefs {
  return { ...m.permissions, ...(m.dynamicPermissions?.(settings as any, config) ?? {}) };
}

/** Core permissions (People, links, admin). */
export const corePermissions = definePermissions('people', {
  approve_members: { label: 'Approve new Members', default: ['captain', 'mentor'], simple: true },
  approve_leaders: { label: 'Approve new Captains and Mentors', default: ['mentor'], simple: true },
  assign_positions: { label: 'Assign positions to people', default: ['mentor'], simple: true },
  assign_badges: { label: 'Assign badge-only positions', default: ['mentor'] },
  view_private: { label: 'See private profile fields (emergency contacts)', default: ['mentor'] },
  reset_password: { label: 'Generate password reset links', default: ['mentor'] },
  deactivate: { label: 'Deactivate or remove people', default: ['mentor'] },
  request_info: { label: 'Request info from members (Request info)', default: ['mentor'] },
});
export const coreLinkPermissions = definePermissions('core', {
  edit_links: { label: 'Edit team tool links', default: ['mentor'], simple: true },
});
export const allCorePermissions: PermissionDefs = { ...corePermissions, ...coreLinkPermissions };

/** Edge functions every install gets (spec §3.4). */
export const CORE_FUNCTIONS = ['admin-reset-link', 'admin-delete-user', 'cleanup'] as const;
/** Functions that must be callable without a user JWT. */
export const PUBLIC_FUNCTIONS = ['cleanup', 'ical'];
