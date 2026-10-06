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

// ── Who can join ────────────────────────────────────────────────────────────
/** A lowercase email domain like "example.edu" (same rule as the database). */
export const EMAIL_DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** "@YourSchool.org", "name@yourschool.org" or " yourschool.org " → "example.edu" (null if invalid). */
export function normalizeEmailDomain(input: string): string | null {
  const d = input.trim().toLowerCase().split('@').pop()!.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  return EMAIL_DOMAIN_RE.test(d) ? d : null;
}

/** Same check the database makes (subdomains count). An empty list allows every email. */
export function emailDomainAllowed(email: string, domains: string[]): boolean {
  if (!domains.length) return true;
  const dom = email.trim().toLowerCase().split('@')[1] ?? '';
  return domains.some((d) => dom === d || dom.endsWith(`.${d}`));
}

// ── Versions & updates ──────────────────────────────────────────────────────
/** Where TeamHub updates come from: the upstream GitHub repository (owner/name). */
export const TEAMHUB_UPSTREAM_REPO = 'elikorpus/teamhub-ftc';

/** Who made TeamHub. Shown on the login page, in Admin > Help and in the setup wizard. Keep it (see LICENSE). */
export const TEAMHUB_CREDIT = {
  team: 'FTC Team 23208',
  url: 'https://ftcscout.org/teams/23208',
};

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

/**
 * Suggested name for a team's fork: "<team or organization>-teamhub", lowercase with hyphens, e.g.
 * "Example Robotics" → "example-robotics-teamhub". Keeps forks recognizable in a GitHub account and makes GitHub Pages
 * addresses read well (example-robotics.github.io/example-robotics-teamhub).
 */
export function suggestedRepoName(teamOrOrg: string | null | undefined): string {
  const base = (teamOrOrg ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
  return base ? `${base}-teamhub` : 'my-team-teamhub';
}

/** GitHub repository names: letters, numbers, ".", "-" and "_", up to 100 characters. */
export const isValidRepoName = (name: string) => /^[A-Za-z0-9._-]{1,100}$/.test(name) && !/^\.+$/.test(name);

/** Does a git remote URL point at the original TeamHub repository (rather than a team's own copy, whatever it's named)? */
export function isUpstreamRemote(remote: string | null | undefined): boolean {
  const r = (remote ?? '').trim().toLowerCase().replace(/\.git$/, '').replace(/\/$/, '');
  const up = TEAMHUB_UPSTREAM_REPO.toLowerCase();
  return r.endsWith(`github.com/${up}`) || r.endsWith(`github.com:${up}`);
}

export type FieldLevel = 'everyone' | 'leaders' | 'mentors';
/** Who can see a profile field. Older configs only say private: true, which meant mentors only. */
export const fieldLevel = (f: { visibility?: FieldLevel | null; private?: boolean }): FieldLevel => f.visibility ?? (f.private ? 'mentors' : 'everyone');
/** Where each level's answers are stored: on the profile, or in a table only some people can read. */
export const FIELD_TABLE = { everyone: 'profiles', leaders: 'profiles_leaders', mentors: 'profiles_private' } as const;
