/**
 * Registries (spec §4.5). The dashboard calls initRuntime() once with the generated module list; modules and the
 * shell then ask the registries: modules never import each other.
 */
import type { ComponentType } from 'react';
import type {
  CalendarOverlay,
  IntegrationClient,
  LoadedModule,
  QuickAction,
  RuntimeConfig,
  Sb,
  SchemaExpectations,
} from './types';

export interface Runtime {
  config: RuntimeConfig;
  modules: LoadedModule[];
  integrations: IntegrationClient[];
  integrationIds: string[];
  permissions: Record<string, { types: string[]; positions: string[] }>;
  schema: SchemaExpectations;
  basePath: string;
}

let rt: Runtime | null = null;
let sb: Sb | null = null;

export function initRuntime(r: Runtime) {
  rt = r;
}
export function runtime(): Runtime {
  if (!rt) throw new Error('TeamHub runtime not initialized');
  return rt;
}
export function setSupabase(client: Sb) {
  sb = client;
}
export function getSupabase(): Sb {
  if (!sb) throw new Error('Supabase client not initialized');
  return sb;
}

export function isModuleEnabled(id: string): boolean {
  return !!rt?.modules.some((m) => m.manifest.id === id);
}
export function getModule(id: string): LoadedModule | undefined {
  return rt?.modules.find((m) => m.manifest.id === id);
}
export function isIntegrationEnabled(id: string): boolean {
  return !!rt?.integrationIds.includes(id);
}

export function allQuickActions(): (QuickAction & { module: string })[] {
  const out: (QuickAction & { module: string })[] = [];
  for (const m of rt?.modules ?? []) for (const q of m.client.quickActions ?? []) out.push({ ...q, module: m.manifest.id });
  for (const i of rt?.integrations ?? []) for (const q of i.quickActions ?? []) out.push({ ...q, module: i.id });
  return out;
}

/** Components registered for a slot by modules and integrations. */
export function slotComponents(name: string): ComponentType<any>[] {
  const out: ComponentType<any>[] = [];
  for (const m of rt?.modules ?? []) {
    const c = m.client.slots?.[name];
    if (c) out.push(c);
  }
  for (const i of rt?.integrations ?? []) {
    const c = i.slots?.[name];
    if (c) out.push(c);
  }
  return out;
}

export function calendarOverlays(): CalendarOverlay[] {
  const out: CalendarOverlay[] = [];
  for (const m of rt?.modules ?? []) out.push(...(m.client.calendarOverlays ?? []));
  for (const i of rt?.integrations ?? []) out.push(...(i.calendarOverlays ?? []));
  return out;
}

export function moduleSettings<T = Record<string, unknown>>(id: string): T {
  return (rt?.config.moduleSettings[id] ?? {}) as T;
}

/** Router path for a module page, e.g. path('tasks', '42'). */
export function modulePath(id: string, ...rest: (string | number)[]): string {
  return `/${[id, ...rest.map(String)].join('/')}`;
}
