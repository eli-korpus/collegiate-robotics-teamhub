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

// ── Versions & updates ──────────────────────────────────────────────────────
/** Where TeamHub updates come from: the upstream GitHub repository (owner/name). */
export const TEAMHUB_UPSTREAM_REPO = 'elikorpus/teamhub-ftc';

/** "v1.2.3" or "1.2.3" → [1, 2, 3]. Pre-release suffixes are ignored. Null if it isn't a version. */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec((v ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Negative if a < b, 0 if equal, positive if a > b. Unparseable versions sort first. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a) ?? [-1, 0, 0];
  const y = parseVersion(b) ?? [-1, 0, 0];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return !!parseVersion(candidate) && compareVersions(candidate, current) > 0;
}

/** A major update (1.x → 2.x) can include breaking changes and has an upgrade guide. */
export function isMajorUpgrade(from: string, to: string): boolean {
  const a = parseVersion(from);
  const b = parseVersion(to);
  return !!a && !!b && b[0] > a[0];
}

/** Release convention: a security release has "security" in its title (the release workflow adds it). */
export function isSecurityRelease(title: string | null | undefined): boolean {
  return /\bsecurity\b/i.test(title ?? '');
}
