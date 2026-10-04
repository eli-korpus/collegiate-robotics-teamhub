import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareVersions, isMajorUpgrade, isNewerVersion, isSecurityRelease, isUpstreamRemote, isValidRepoName, parseVersion, suggestedRepoName } from '@teamhub/config-schema/util';
import { bumpVersion, changelogSections, cutRelease, hasSecuritySection, notesBetween, notesFor } from '@teamhub/generator';

const md = `# Changelog

## [Unreleased]

### Fixed

- A bug.

## [1.1.0] - 2026-11-01

### Added

- Thing B.

## [1.0.1] - 2026-10-10

### Security

- Patched C.

## [1.0.0] - 2026-10-02

- First.
`;

describe('versions', () => {
  it('parses and compares semantic versions', () => {
    expect(parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('nope')).toBeNull();
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0);
    expect(isNewerVersion('v1.1.0', '1.0.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
    expect(isMajorUpgrade('1.4.2', '2.0.0')).toBe(true);
    expect(isMajorUpgrade('1.4.2', '1.5.0')).toBe(false);
    expect(isSecurityRelease('TeamHub v1.0.1 (security update)')).toBe(true);
  });
  it('bumps versions', () => {
    expect(bumpVersion('1.2.3', 'patch')).toBe('1.2.4');
    expect(bumpVersion('1.2.3', 'minor')).toBe('1.3.0');
    expect(bumpVersion('1.2.3', 'major')).toBe('2.0.0');
  });
});

describe('changelog', () => {
  it('reads sections and notes between versions', () => {
    expect(changelogSections(md).map((s) => s.version)).toEqual(['Unreleased', '1.1.0', '1.0.1', '1.0.0']);
    expect(notesFor(md, '1.1.0')).toContain('Thing B');
    expect(notesBetween(md, '1.0.0', '1.1.0').map((s) => s.version)).toEqual(['1.1.0', '1.0.1']);
    expect(hasSecuritySection(notesFor(md, '1.0.1'))).toBe(true);
  });
  it('cuts a release from Unreleased and refuses empty or duplicate releases', () => {
    const out = cutRelease(md, '1.2.0', '2026-12-01');
    expect(notesFor(out, '1.2.0')).toContain('A bug.');
    expect(notesFor(out, 'Unreleased')).toBe('');
    expect(() => cutRelease(out, '1.2.1', '2026-12-02')).toThrow(/nothing under/);
    expect(() => cutRelease(md, '1.1.0', '2026-12-01')).toThrow(/already has/);
  });
  it('the real CHANGELOG.md parses and its newest release matches package.json', () => {
    const real = readFileSync('docs/CHANGELOG.md', 'utf8');
    const released = changelogSections(real).filter((s) => s.version !== 'Unreleased');
    expect(released[0].version).toBe(JSON.parse(readFileSync('package.json', 'utf8')).version);
  });
});

describe('fork names', () => {
  it('suggests "<team or organization>-teamhub" and accepts any valid name', () => {
    expect(suggestedRepoName('Example Robotics')).toBe('example-robotics-teamhub');
    expect(suggestedRepoName('Gear Grinders #23209!')).toBe('gear-grinders-23209-teamhub');
    expect(suggestedRepoName('')).toBe('my-team-teamhub');
    expect(isValidRepoName('example-robotics-teamhub')).toBe(true);
    expect(isValidRepoName('has space')).toBe(false);
  });
  it('recognizes only the original TeamHub repository, whatever a team named its copy', () => {
    expect(isUpstreamRemote('https://github.com/elikorpus/teamhub-ftc.git')).toBe(true);
    expect(isUpstreamRemote('git@github.com:elikorpus/teamhub-ftc.git')).toBe(true);
    expect(isUpstreamRemote('https://github.com/example-robotics/teamhub-ftc.git')).toBe(false);
    expect(isUpstreamRemote('https://github.com/example-robotics/example-robotics-teamhub.git')).toBe(false);
  });
});
