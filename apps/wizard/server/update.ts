/**
 * Updating a team's fork to a new TeamHub release (docs/updating.md).
 *
 * The wizard gets the new version straight from the upstream repository (never GitHub's "Sync fork" button, whose
 * "Discard commits" option would delete the team's settings), merges the release tag into the team's branch, and
 * updates the database BEFORE pushing, so the live site never runs code that's ahead of its database.
 *
 * Progress is kept in .git/teamhub-update.json (never committed) so the flow survives the wizard restarting itself
 * after `npm install`, and so "Undo update" knows which merge to revert.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { TEAMHUB_UPSTREAM_REPO, compareVersions, isMajorUpgrade, isNewerVersion, parseVersion } from '@teamhub/config-schema/util';
import { notesBetween } from '@teamhub/generator';
import { sh } from './git';

/** The remote name the wizard manages for TeamHub releases (separate from a team's own "upstream" if they have one). */
export const UPDATE_REMOTE = 'teamhub-releases';

export function upstreamUrl(): string {
  return process.env.TEAMHUB_UPSTREAM_URL ?? `https://github.com/${TEAMHUB_UPSTREAM_REPO}.git`;
}

/** Files TeamHub writes into a fork for the team. Changes to these are expected and never count as customizations. */
const TEAM_OWNED = ['team/', 'wrangler.jsonc', 'vercel.json', 'netlify.toml', '.github/workflows/pages.yml', '.github/workflows/keepalive.yml', '.github/workflows/teamhub-updates.yml', 'CUSTOMIZATIONS.md'];
const isTeamOwned = (path: string) => TEAM_OWNED.some((p) => (p.endsWith('/') ? path.startsWith(p) : path === p));

export interface UpdateCheck {
  current: string;
  latest: string | null;
  available: boolean;
  major: boolean;
  /** Changelog sections between the current and latest version, newest first. */
  notes: { version: string; date: string | null; body: string }[];
  /** TeamHub files the team changed (merge conflicts can only happen here). */
  customized: string[];
  /** Contents of CUSTOMIZATIONS.md, if the team keeps one. */
  customizationsNote: string | null;
  /** Uncommitted changes that must be committed or undone before updating. */
  dirty: string[];
  /** Last completed update, for "Undo update". */
  last: UpdateState | null;
}

export interface UpdateState {
  stage: 'merged' | 'done' | 'rolled-back';
  from: string;
  to: string;
  /** HEAD before the merge, and the merge commit (for undo). */
  before: string;
  merge: string;
  backupPath: string | null;
  /** Set after "Undo update": the revert commit, which the next update re-applies before merging. */
  revert?: string;
  at: string;
}

const git = (root: string, args: string[], timeout = 120_000) => sh('git', args, { cwd: root, timeout });
const lines = (out: string): string[] => String(out).split('\n').map((l) => l.trim()).filter(Boolean);

export function localVersion(root: string): string {
  return (JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { version: string }).version;
}

async function stateFile(root: string): Promise<string> {
  const dir = (await git(root, ['rev-parse', '--git-dir'])).stdout.trim() || '.git';
  return isAbsolute(dir) ? join(dir, 'teamhub-update.json') : join(root, dir, 'teamhub-update.json');
}

export async function readState(root: string): Promise<UpdateState | null> {
  const f = await stateFile(root);
  return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')) as UpdateState) : null;
}

export async function writeState(root: string, s: UpdateState | null): Promise<void> {
  const f = await stateFile(root);
  if (s) writeFileSync(f, JSON.stringify(s, null, 2));
  else if (existsSync(f)) rmSync(f);
}

/** Points the managed remote at the upstream repository and fetches its release tags. */
async function fetchReleases(root: string): Promise<{ ok: boolean; error?: string }> {
  const url = upstreamUrl();
  const has = await git(root, ['remote', 'get-url', UPDATE_REMOTE]);
  const set = has.ok ? await git(root, ['remote', 'set-url', UPDATE_REMOTE, url]) : await git(root, ['remote', 'add', UPDATE_REMOTE, url]);
  if (!set.ok) return { ok: false, error: set.stderr };
  // Only tags (and the history they need) — the team's branches are never touched.
  const f = await git(root, ['fetch', '--no-tags', UPDATE_REMOTE, '+refs/tags/v*:refs/tags/v*'], 300_000);
  return f.ok ? { ok: true } : { ok: false, error: f.stderr.trim() || f.stdout.trim() };
}

async function latestTag(root: string): Promise<string | null> {
  const tags = lines((await git(root, ['tag', '--list', 'v*.*.*'])).stdout).filter((t) => parseVersion(t));
  return tags.sort(compareVersions).at(-1) ?? null;
}

async function dirtyFiles(root: string): Promise<string[]> {
  return String((await git(root, ['status', '--porcelain'])).stdout)
    .split('\n')
    .filter(Boolean)
    .map((l) => l.slice(3).trim());
}

/** TeamHub files the team changed since the release they're on (team-owned files don't count). */
async function customizedFiles(root: string, current: string): Promise<string[]> {
  const base = `v${current}`;
  if (!(await git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`])).ok) return [];
  return lines((await git(root, ['diff', '--name-only', `${base}..HEAD`])).stdout).filter((p) => !isTeamOwned(p));
}

export async function checkForUpdate(root: string): Promise<UpdateCheck & { error?: string }> {
  const current = localVersion(root);
  const fetched = await fetchReleases(root);
  const latest = await latestTag(root);
  const available = !!latest && isNewerVersion(latest, current);
  let notes: UpdateCheck['notes'] = [];
  if (available) {
    const md = await git(root, ['show', `${latest}:CHANGELOG.md`]);
    if (md.ok) notes = notesBetween(String(md.stdout), current, latest!);
  }
  const cust = join(root, 'CUSTOMIZATIONS.md');
  return {
    current,
    latest: latest ? latest.replace(/^v/, '') : null,
    available,
    major: available && isMajorUpgrade(current, latest!),
    notes,
    customized: await customizedFiles(root, current),
    customizationsNote: existsSync(cust) ? readFileSync(cust, 'utf8') : null,
    dirty: await dirtyFiles(root),
    last: await readState(root),
    ...(fetched.ok ? {} : { error: `Couldn't reach the TeamHub releases (${fetched.error}). Check your internet connection.` }),
  };
}

export type MergeResult = { ok: true; state: UpdateState } | { ok: false; conflicts: string[]; message: string };

/**
 * Merges release `tag` into the current branch with a merge commit (so it can be undone with one revert).
 * On a conflict nothing is left half-done: the merge is aborted and the conflicting files are reported.
 */
export async function mergeRelease(root: string, tag: string, backupPath: string | null): Promise<MergeResult> {
  const from = localVersion(root);
  const dirty = await dirtyFiles(root);
  if (dirty.length) return { ok: false, conflicts: [], message: `Commit or undo these changes first: ${dirty.join(', ')}` };
  // If someone already pushed changes to the team's fork (e.g. from another computer), get them first.
  const upstreamBranch = await git(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstreamBranch.ok) {
    await git(root, ['fetch', 'origin'], 300_000);
    const pull = await git(root, ['merge', '--ff-only', '@{u}']);
    if (!pull.ok) return { ok: false, conflicts: [], message: `Your copy and GitHub have different changes. Run "git pull" and sort that out first.\n${pull.stderr}` };
  }
  const before = (await git(root, ['rev-parse', 'HEAD'])).stdout.trim();
  // After an "Undo update", git would otherwise skip the undone changes when merging a newer release.
  const prev = await readState(root);
  if (prev?.stage === 'rolled-back' && prev.revert) {
    const redo = await git(root, ['revert', '--no-edit', prev.revert]);
    if (!redo.ok) {
      await git(root, ['revert', '--abort']);
      return { ok: false, conflicts: [], message: `Couldn't re-apply the update you undid earlier: ${redo.stderr || redo.stdout}` };
    }
  }
  const merge = await git(root, ['merge', '--no-ff', '--no-edit', '-m', `Update TeamHub to ${tag}`, tag]);
  if (!merge.ok) {
    const conflicts = lines((await git(root, ['diff', '--name-only', '--diff-filter=U'])).stdout);
    await git(root, ['merge', '--abort']);
    // Leave the branch exactly as it was (including any re-applied undo).
    await git(root, ['reset', '--hard', before]);
    return {
      ok: false,
      conflicts,
      message: conflicts.length
        ? 'This update changes the same parts of these files as your team did, so it was stopped. Nothing was changed.'
        : `The update couldn't be merged. Nothing was changed.\n${merge.stderr || merge.stdout}`,
    };
  }
  const state: UpdateState = { stage: 'merged', from, to: tag.replace(/^v/, ''), before, merge: (await git(root, ['rev-parse', 'HEAD'])).stdout.trim(), backupPath, at: new Date().toISOString() };
  await writeState(root, state);
  return { ok: true, state };
}

export async function installDependencies(root: string) {
  return sh(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund'], { cwd: root, timeout: 15 * 60_000 });
}

/** Undo the last update's code: revert its merge commit (database changes are add-only, so they can stay). */
export async function revertUpdate(root: string): Promise<{ ok: boolean; message: string; state?: UpdateState }> {
  const s = await readState(root);
  if (!s || s.stage === 'rolled-back') return { ok: false, message: 'There is no update to undo.' };
  const dirty = await dirtyFiles(root);
  if (dirty.length) return { ok: false, message: `Commit or undo these changes first: ${dirty.join(', ')}` };
  const r = await git(root, ['revert', '-m', '1', '--no-edit', s.merge]);
  if (!r.ok) {
    await git(root, ['revert', '--abort']);
    return { ok: false, message: `Couldn't undo automatically: ${r.stderr || r.stdout}` };
  }
  const next: UpdateState = { ...s, stage: 'rolled-back', revert: (await git(root, ['rev-parse', 'HEAD'])).stdout.trim(), at: new Date().toISOString() };
  await writeState(root, next);
  return { ok: true, message: `Went back to TeamHub ${s.from}.`, state: next };
}
