import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { REPO_ROOT } from '@teamhub/generator';

const run = promisify(execFile);

export async function sh(cmd: string, args: string[], opts: { cwd?: string; timeout?: number } = {}) {
  try {
    const { stdout, stderr } = await run(cmd, args, { cwd: opts.cwd ?? REPO_ROOT, timeout: opts.timeout ?? 120_000, maxBuffer: 20 * 1024 * 1024 });
    return { ok: true, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (e: any) {
    return { ok: false, stdout: e.stdout?.toString() ?? '', stderr: e.stderr?.toString() ?? e.message, code: e.code };
  }
}

export async function gitStatus() {
  const isRepo = (await sh('git', ['rev-parse', '--is-inside-work-tree'])).ok;
  if (!isRepo) return { isRepo: false } as const;
  const [branch, remote, status, user, upstream] = await Promise.all([
    sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']),
    sh('git', ['remote', 'get-url', 'origin']),
    sh('git', ['status', '--porcelain']),
    sh('git', ['config', 'user.name']),
    sh('git', ['remote', 'get-url', 'upstream']),
  ]);
  const remoteUrl = remote.ok ? remote.stdout.trim() : null;
  const gh = await ghStatus(remoteUrl);
  return {
    isRepo: true,
    branch: branch.stdout.trim(),
    remote: remoteUrl,
    hasUpstream: upstream.ok,
    dirty: status.stdout
      .split('\n')
      .filter(Boolean)
      .map((l: string) => l.slice(3)),
    userConfigured: !!user.stdout.trim(),
    gh,
  } as const;
}

/** Is `gh` installed/authenticated, and is origin a fork? (spec §5.2 step 12) */
export async function ghStatus(remote: string | null) {
  const v = await sh('gh', ['--version']);
  if (!v.ok) return { installed: false, authed: false, isFork: null as boolean | null, repo: null as string | null };
  const auth = await sh('gh', ['auth', 'status']);
  let isFork: boolean | null = null;
  let repo: string | null = null;
  if (auth.ok && remote) {
    const r = await sh('gh', ['repo', 'view', '--json', 'isFork,nameWithOwner,parent']);
    if (r.ok) {
      const j = JSON.parse(r.stdout);
      isFork = j.isFork;
      repo = j.nameWithOwner;
    }
  }
  return { installed: true, authed: auth.ok, isFork, repo };
}

/** Commit only what TeamHub owns in a fork (team/, host files, workflows) and push. */
export async function publish(message: string, paths: string[]) {
  const add = await sh('git', ['add', '--', ...paths]);
  if (!add.ok) return add;
  const staged = await sh('git', ['diff', '--cached', '--name-only']);
  if (!staged.stdout.trim()) return { ok: true, stdout: 'Nothing new to commit.', stderr: '' };
  const commit = await sh('git', ['commit', '-m', message]);
  if (!commit.ok) return commit;
  const push = await sh('git', ['push'], { timeout: 180_000 });
  if (!push.ok) {
    const branch = (await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim();
    return sh('git', ['push', '-u', 'origin', branch], { timeout: 180_000 });
  }
  return push;
}
