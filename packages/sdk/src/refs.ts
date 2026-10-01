/** Entity references: "<moduleId>:<entityType>:<id>" (spec §10.4). */
export interface EntityRef {
  module: string;
  type: string;
  id: string;
}

export function makeRef(module: string, type: string, id: string | number): string {
  return `${module}:${type}:${id}`;
}

export function parseRef(ref: string | null | undefined): EntityRef | null {
  if (!ref) return null;
  const [module, type, ...rest] = ref.split(':');
  if (!module || !type || !rest.length) return null;
  return { module, type, id: rest.join(':') };
}

export function isUrl(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//i.test(s);
}
