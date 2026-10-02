/** Zod-free helpers safe to import in the browser bundle (importing the schema pulls in zod). */
export const PROFILE_TYPES = ['member', 'captain', 'mentor'] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

/** "2026–27" → 2026 (FTCScout season number, spec P5). */
export function seasonYear(label: string): number {
  const m = /^(\d{4})/.exec(label);
  return m ? Number(m[1]) : new Date().getFullYear();
}

/** Default season label for a date: seasons start in September. */
export function defaultSeasonLabel(d = new Date()): string {
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}–${String((y + 1) % 100).padStart(2, '0')}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

export function positionIdFor(name: string): string {
  return `pos_${slugify(name) || 'position'}`;
}
