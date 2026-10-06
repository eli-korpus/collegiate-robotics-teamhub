/**
 * The update flow against real git repositories: a fake TeamHub upstream, a team's GitHub fork (bare) and their
 * local copy. Covers checking, merging, keeping team files, undo, updating again after undo, and conflicts.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkForUpdate, localVersion, mergeRelease, readState, revertUpdate } from './update';

const tmp = mkdtempSync(join(tmpdir(), 'teamhub-update-'));
const upstream = join(tmp, 'upstream');
const forkBare = join(tmp, 'fork.git');
const local = join(tmp, 'local');

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const write = (dir: string, file: string, content: string) => {
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(join(dir, file), content);
};
const changelog = (versions: [string, string][]) =>
  `# Changelog\n\n## [Unreleased]\n\n${versions.map(([v, note]) => `## [${v}] - 2026-10-0${v.at(-1)}\n\n### Added\n\n- ${note}\n`).join('\n')}`;

/** Publishes a TeamHub release in the fake upstream repository. */
function release(version: string, file: string, content: string, notes: [string, string][]) {
  write(upstream, 'package.json', JSON.stringify({ name: 'teamhub-ftc', version }, null, 2) + '\n');
  write(upstream, file, content);
  write(upstream, 'docs/CHANGELOG.md', changelog(notes));
  git(upstream, 'add', '-A');
  git(upstream, 'commit', '-m', `Release v${version}`);
  git(upstream, 'tag', '-a', `v${version}`, '-m', `TeamHub v${version}`);
}

beforeAll(() => {
  // Isolate from the developer's git settings (signing, hooks, names).
  process.env.GIT_CONFIG_GLOBAL = join(tmp, 'gitconfig');
  process.env.GIT_CONFIG_NOSYSTEM = '1';
  writeFileSync(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = Test\n\temail = test@example.com\n[init]\n\tdefaultBranch = main\n');
  process.env.TEAMHUB_UPSTREAM_URL = upstream;
  mkdirSync(upstream);
  git(upstream, 'init');
  write(upstream, 'app.txt', 'line 1\nline 2\nline 3\n');
  release('1.0.0', 'feature-a.txt', 'A\n', [['1.0.0', 'First release']]);
  // The team forks on GitHub (bare) and clones it.
  git(tmp, 'clone', '--bare', upstream, forkBare);
  git(tmp, 'clone', forkBare, local);
  write(local, 'team/teamhub.config.json', '{"program":{"name":"Robots"}}\n');
  git(local, 'add', '-A');
  git(local, 'commit', '-m', 'Our TeamHub settings');
  git(local, 'push');
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('updating a fork', () => {
  it('reports when there is nothing new', async () => {
    const c = await checkForUpdate(local);
    expect(c).toMatchObject({ current: '1.0.0', latest: '1.0.0', available: false, dirty: [], customized: [] });
  });

  it('finds a new release with its notes, merges it, and keeps the team settings', async () => {
    release('1.1.0', 'feature-b.txt', 'B\n', [['1.1.0', 'Thing B'], ['1.0.0', 'First release']]);
    const c = await checkForUpdate(local);
    expect(c).toMatchObject({ current: '1.0.0', latest: '1.1.0', available: true, major: false });
    expect(c.notes.map((n) => n.version)).toEqual(['1.1.0']);
    const r = await mergeRelease(local, 'v1.1.0', '/backups/x.zip');
    expect(r.ok).toBe(true);
    expect(localVersion(local)).toBe('1.1.0');
    expect(readFileSync(join(local, 'feature-b.txt'), 'utf8')).toBe('B\n');
    expect(readFileSync(join(local, 'team/teamhub.config.json'), 'utf8')).toContain('Robots');
    expect(await readState(local)).toMatchObject({ stage: 'merged', from: '1.0.0', to: '1.1.0', backupPath: '/backups/x.zip' });
  });

  it('undoes an update, then updates again later without losing the undone changes', async () => {
    const undo = await revertUpdate(local);
    expect(undo.ok).toBe(true);
    expect(localVersion(local)).toBe('1.0.0');
    release('1.2.0', 'feature-c.txt', 'C\n', [['1.2.0', 'Thing C'], ['1.1.0', 'Thing B'], ['1.0.0', 'First release']]);
    const c = await checkForUpdate(local);
    expect(c.notes.map((n) => n.version)).toEqual(['1.2.0', '1.1.0']);
    const r = await mergeRelease(local, 'v1.2.0', null);
    expect(r.ok).toBe(true);
    expect(localVersion(local)).toBe('1.2.0');
    // Changes from the undone 1.1.0 come back along with 1.2.0.
    expect(readFileSync(join(local, 'feature-b.txt'), 'utf8')).toBe('B\n');
    expect(readFileSync(join(local, 'feature-c.txt'), 'utf8')).toBe('C\n');
  });

  it('lists the team’s own code changes and stops cleanly on a conflict', async () => {
    write(local, 'app.txt', 'line 1\nOUR CHANGE\nline 3\n');
    git(local, 'commit', '-am', 'Customize app');
    release('1.3.0', 'app.txt', 'line 1\nUPSTREAM CHANGE\nline 3\n', [['1.3.0', 'Changed app'], ['1.2.0', 'Thing C']]);
    const head = git(local, 'rev-parse', 'HEAD');
    const c = await checkForUpdate(local);
    expect(c.customized).toEqual(['app.txt']);
    const r = await mergeRelease(local, 'v1.3.0', null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.conflicts).toEqual(['app.txt']);
    expect(git(local, 'rev-parse', 'HEAD')).toBe(head);
    expect(git(local, 'status', '--porcelain')).toBe('');
  });

  it('refuses to update with uncommitted changes, and flags major releases', async () => {
    write(local, 'scratch.txt', 'x');
    const r = await mergeRelease(local, 'v1.3.0', null);
    expect(r).toMatchObject({ ok: false });
    rmSync(join(local, 'scratch.txt'));
    git(local, 'reset', '--hard', 'HEAD~1'); // drop the customization so 2.0.0 merges cleanly
    release('2.0.0', 'feature-d.txt', 'D\n', [['2.0.0', 'Big change'], ['1.3.0', 'Changed app']]);
    const c = await checkForUpdate(local);
    expect(c).toMatchObject({ latest: '2.0.0', major: true });
  });

  it('takes the release’s package-lock.json when that is the only conflict', async () => {
    release('2.0.1', 'package-lock.json', '{\n  "version": "2.0.1"\n}\n', [['2.0.1', 'Lockfile']]);
    await checkForUpdate(local);
    const first = await mergeRelease(local, 'v2.0.1', null);
    expect(first, JSON.stringify(first)).toMatchObject({ ok: true });
    // Installing on the team's computer rewrote it, and they committed that (this blocked updates before).
    write(local, 'package-lock.json', '{\n  "version": "2.0.1-local"\n}\n');
    git(local, 'commit', '-am', 'package-lock after install');
    release('2.0.2', 'package-lock.json', '{\n  "version": "2.0.2"\n}\n', [['2.0.2', 'Lockfile again']]);
    await checkForUpdate(local);
    const r = await mergeRelease(local, 'v2.0.2', null);
    expect(r, JSON.stringify(r)).toMatchObject({ ok: true });
    expect(readFileSync(join(local, 'package-lock.json'), 'utf8')).toContain('"2.0.2"');
    expect(git(local, 'status', '--porcelain')).toBe('');
  });
});
