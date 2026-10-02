import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ProfileType, TeamConfig, PositionConfig, SubteamConfig, ProfileFieldConfig, TeamhubConfig } from '@teamhub/config-schema';
import type { CalendarItem } from '@teamhub/ui';
import type { ModuleManifest } from './define';

export type Sb = Pick<SupabaseClient<any, 'public', any>, 'from' | 'rpc' | 'auth' | 'storage' | 'functions'>;

/** The non-secret config baked into the build (generated/config.ts). */
export interface RuntimeConfig {
  program: TeamhubConfig['program'];
  teams: TeamConfig[];
  theme: TeamhubConfig['theme'];
  season: string;
  subteams: SubteamConfig[];
  positions: PositionConfig[];
  profileFields: ProfileFieldConfig[];
  home: TeamhubConfig['home'];
  hosting: TeamhubConfig['hosting'];
  supabase: { url: string | null; anonKey: string | null };
  features: TeamhubConfig['features'];
  moduleSettings: Record<string, Record<string, unknown>>;
  dormantModules: string[];
  /** Every installed module (active + dormant) — used by Admin storage/status views. */
  installed: { id: string; name: string; prefix: string; state: 'active' | 'dormant'; buckets: string[] }[];
}

export interface Profile {
  id: string;
  display_name: string;
  avatar_path: string | null;
  is_admin: boolean;
  status: 'pending' | 'active' | 'inactive';
  details: Record<string, string>;
  home_prefs: HomePrefs | null;
  created_at: string;
}
export interface HomePrefs {
  order?: string[];
  hidden?: string[];
}
export interface Membership {
  user_id: string;
  team_id: string;
  type: ProfileType;
  status: 'pending' | 'active' | 'inactive';
  requested_type: ProfileType | null;
  note: string | null;
  created_at?: string;
}
export interface PositionHolder {
  position_id: string;
  user_id: string;
  team_id: string | null;
}
export interface PositionRow {
  id: string;
  name: string;
  team_id: string | null;
  grants_permissions: boolean;
  source: 'config' | 'app';
}

export interface Me {
  id: string;
  email: string | null;
  profile: Profile;
  memberships: Membership[];
  holders: PositionHolder[];
  isAdmin: boolean;
  isActive: boolean;
}

export interface PersonInfo {
  id: string;
  name: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  status: Profile['status'];
  details: Record<string, string>;
  memberships: Membership[];
  positionIds: string[];
  positions: string[];
}

// ── Module client contributions (registries, spec §4.5) ────────────────────
export interface WidgetDef {
  id: string;
  title: string;
  /** 'today' widgets render in the Today strip (and return null when there's nothing to show). */
  priority?: 'today' | 'normal';
  size?: 'sm' | 'md' | 'lg';
  component: LazyExoticComponent<ComponentType<{ teamId: string | null }>> | ComponentType<{ teamId: string | null }>;
  /** Only shown when the viewer holds this permission (in any team). */
  perm?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
}
export type SearchProvider = (sb: Sb, query: string) => Promise<SearchResult[]>;

export interface EntityInfo {
  title: string;
  href: string;
  subtitle?: string;
}
export interface EntityDef {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  fetch: (sb: Sb, id: string) => Promise<EntityInfo | null>;
}

export interface QuickAction {
  id: string;
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  perm?: string;
  keywords?: string;
  /** Path to navigate to (usually the composer of the owning tab). */
  href: string;
  /** Module ids whose "New …" menu should offer this as a typed shortcut (spec P6). */
  newMenuFor?: string[];
}

export interface ProfileSectionDef {
  id: string;
  title: string;
  component: LazyExoticComponent<ComponentType<{ userId: string }>> | ComponentType<{ userId: string }>;
  /** Shown only to the person themself and holders of this permission. */
  perm?: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  actor: string | null;
  text: string;
  href: string;
  module?: string;
}
export type ActivityProvider = (sb: Sb, limit: number) => Promise<ActivityItem[]>;

export interface NotificationDef {
  /** "assigned you a task" — rendered after the actor name. */
  text: string;
}

export interface CalendarOverlayItem extends CalendarItem {
  href: string;
  /** For merging manual competition events with FTCScout events. */
  eventCode?: string | null;
  teamId?: string | null;
}
export type CalendarOverlay = (sb: Sb, range: { from: Date; to: Date }) => Promise<CalendarOverlayItem[]>;

export interface ModuleClient {
  icon: ComponentType<{ className?: string }>;
  Routes: LazyExoticComponent<ComponentType> | ComponentType;
  widgets?: WidgetDef[];
  search?: SearchProvider;
  entities?: Record<string, EntityDef>;
  quickActions?: QuickAction[];
  profileSections?: ProfileSectionDef[];
  activity?: ActivityProvider;
  notifications?: Record<string, NotificationDef>;
  /** Components contributed to named slots in other UIs (rarely used by modules; mostly by integrations). */
  slots?: Record<string, ComponentType<any>>;
  calendarOverlays?: CalendarOverlay[];
  /** Badge count for the sidebar item (e.g. unread announcements). */
  useBadge?: () => number | undefined;
}

export interface IntegrationClient {
  id: string;
  slots?: Record<string, ComponentType<any>>;
  calendarOverlays?: CalendarOverlay[];
  quickActions?: QuickAction[];
}

export interface LoadedModule {
  /** Serializable manifest data (settings schema stripped; settings values are in RuntimeConfig.moduleSettings). */
  manifest: ModuleMeta;
  client: ModuleClient;
}

export interface SchemaExpectations {
  core: number;
  modules: Record<string, number>;
  integrations: Record<string, number>;
}

export type Children = { children?: ReactNode };

export type ModuleMeta = Pick<ModuleManifest, 'id' | 'prefix' | 'name' | 'category' | 'icon' | 'summary' | 'purpose' | 'notFor' | 'toolLinkSlots'>;
