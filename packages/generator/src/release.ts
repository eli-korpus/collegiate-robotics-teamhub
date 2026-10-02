/** Pure release helpers: versions and CHANGELOG.md (used by npm run release, the release workflow and the wizard's update notes). */
import { compareVersions, parseVersion } from '@teamhub/config-schema/util';

export type Bump = 'patch' | 'minor' | 'major';

export function bumpVersion(current: string, bump: Bump): string {
  const v = parseVersion(current);
  if (!v) throw new Error(`Not a version: ${current}`);
  const [maj, min, pat] = v;
  return bump === 'major' ? `${maj + 1}.0.0` : bump === 'minor' ? `${maj}.${min + 1}.0` : `${maj}.${min}.${pat + 1}`;
}

const HEADING = /^## \[([^\]]+)\](?: - (\S+))?\s*$/gm;

/** Sections of a Keep a Changelog file, in file order: { version: 'Unreleased' | '1.2.0', date, body }. */
export function changelogSections(md: string): { version: string; date: string | null; body: string }[] {
  const heads = [...md.matchAll(HEADING)];
  return heads.map((h, i) => ({
    version: h[1],
    date: h[2] ?? null,
    body: md.slice(h.index! + h[0].length, i + 1 < heads.length ? heads[i + 1].index : md.length).trim(),
  }));
}

/** Moves the Unreleased notes under a new version heading and leaves an empty Unreleased section. */
export function cutRelease(md: string, version: string, date: string): string {
  const unreleased = changelogSections(md).find((s) => s.version === 'Unreleased');
  if (!unreleased || !unreleased.body.replace(/^###.*$/gm, '').trim()) throw new Error('CHANGELOG.md has nothing under "## [Unreleased]". Add what changed first.');
  if (changelogSections(md).some((s) => s.version === version)) throw new Error(`CHANGELOG.md already has ${version}`);
  return md.replace(/^## \[Unreleased\]\s*$/m, `## [Unreleased]\n\n## [${version}] - ${date}`);
}

/** Notes for one version (release body). */
export function notesFor(md: string, version: string): string {
  return changelogSections(md).find((s) => s.version === version)?.body ?? '';
}

/** Combined notes for every version after `from` up to and including `to` (what an update brings), newest first. */
export function notesBetween(md: string, from: string, to: string): { version: string; date: string | null; body: string }[] {
  return changelogSections(md).filter((s) => s.version !== 'Unreleased' && compareVersions(s.version, from) > 0 && compareVersions(s.version, to) <= 0);
}

/** A release is a security release when its notes have a "### Security" section. */
export function hasSecuritySection(body: string): boolean {
  return /^### Security\b/m.test(body);
}
