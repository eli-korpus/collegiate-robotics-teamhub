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
    sh('git', ['status', '--porcelain', '--untracked-files=all']),
    sh('git', ['config', 'user.name']),
    sh('git', ['remote', 'get-url', 'upstream']),
  ]);
  const remoteUrl = remote.ok ? remote.stdout.trim() : null;
  const [gh, waiting] = await Promise.all([ghStatus(remoteUrl), unpushed(REPO_ROOT)]);
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
    /** Commits made here that aren't on GitHub yet (null when there's nothing to compare with). */
    unpushed: waiting,
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

export type PushFix = 'email' | 'pull' | null;
export interface PublishResult {
  ok: boolean;
  /** Plain-language summary for the wizard. */
  message: string;
  /** What went wrong, in plain language (failures only). */
  problem?: string;
  /** A one-click fix the wizard can offer. */
  fix?: PushFix;
  /** Raw git output, shown under "Details". */
  log: string;
}

/** Turns git's push errors into something a student can act on. */
export function explainPushError(output: string, ctx: { login?: string | null; repo?: string | null } = {}): { problem: string; fix: PushFix } {
  const o = output.toLowerCase();
  if (o.includes('email privacy'))
    return {
      problem:
        'GitHub blocked the upload because your commit would show your private email address (you turned on "Block command line pushes that expose my email"). TeamHub can switch this copy to your private GitHub no-reply address and try again.',
      fix: 'email',
    };
  if (/permission .* denied|403|not have permission|denied to /.test(o))
    return {
      problem: `The GitHub account signed in on this computer${ctx.login ? ` (${ctx.login})` : ''} isn't allowed to change ${ctx.repo ?? 'this repository'}. Either sign in as the account that owns it (in a terminal: gh auth login), or have the owner add ${ctx.login ?? 'your account'} as a collaborator (repository Settings > Collaborators) and try again.`,
      fix: null,
    };
  if (/fetch first|non-fast-forward|\[rejected\]/.test(o))
    return { problem: 'GitHub has changes this computer doesn\'t have yet (maybe from another computer). Get them first, then publish again.', fix: 'pull' };
  if (/could not read username|authentication failed|terminal prompts disabled|invalid username or password/.test(o))
    return { problem: 'This computer isn\'t signed in to GitHub. In a terminal run: gh auth login, then gh auth setup-git, and try again.', fix: null };
  if (/no configured push destination|does not appear to be a git repository|no such remote/.test(o))
    return { problem: 'This folder isn\'t connected to a GitHub copy yet. Use "Make my own copy (fork)" above first.', fix: null };
  if (/could not resolve host|timed out|unable to access/.test(o)) return { problem: 'Couldn\'t reach GitHub. Check your internet connection and try again.', fix: null };
  return { problem: 'Git couldn\'t upload to GitHub. The details below say why.', fix: null };
}

/** How many commits are waiting to be uploaded (null when the branch has no GitHub copy to compare with). */
async function unpushed(cwd: string): Promise<number | null> {
  const r = await sh('git', ['rev-list', '--count', '@{u}..HEAD'], { cwd });
  return r.ok ? Number(r.stdout.trim()) : null;
}

/**
 * Commit only what TeamHub owns in a fork (team/, host files, workflows) and push. Pushes whenever something is
 * waiting, even with nothing new to commit, and only reports success when GitHub accepted it.
 */
export async function publish(message: string, paths: string[], cwd: string = REPO_ROOT, ctx: { login?: string | null; repo?: string | null } = {}): Promise<PublishResult> {
  const out: string[] = [];
  const add = await sh('git', ['add', '--', ...paths], { cwd });
  if (!add.ok) return { ok: false, message: 'Couldn\'t prepare your settings.', problem: 'Git couldn\'t add your settings files.', fix: null, log: add.stderr };
  const staged = await sh('git', ['diff', '--cached', '--name-only'], { cwd });
  if (staged.stdout.trim()) {
    const commit = await sh('git', ['commit', '-m', message], { cwd });
    out.push(commit.stdout + commit.stderr);
    if (!commit.ok) return { ok: false, message: 'Couldn\'t save your settings.', ...explainPushError(commit.stderr, ctx), log: out.join('\n').trim() };
  }
  const waiting = await unpushed(cwd);
  if (waiting === 0) return { ok: true, message: 'Already up to date on GitHub.', log: out.join('\n').trim() || 'Nothing new to upload.' };
  let push = await sh('git', ['push'], { cwd, timeout: 180_000 });
  if (!push.ok && waiting === null) {
    // First publish of this branch: set its GitHub copy.
    const branch = (await sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })).stdout.trim();
    push = await sh('git', ['push', '-u', 'origin', branch], { cwd, timeout: 180_000 });
  }
  out.push(push.stdout + push.stderr);
  const log = out.join('\n').trim();
  if (!push.ok) return { ok: false, message: 'Not uploaded to GitHub yet.', ...explainPushError(log, ctx), log };
  return { ok: true, message: 'Uploaded to GitHub. Your host rebuilds the site in a minute or two.', log };
}

/**
 * Fix for GitHub's email-privacy block: use the account's private no-reply address in this folder, and re-save the
 * commits that haven't been uploaded yet and used the old address (their content doesn't change).
 */
export async function useNoreplyEmail(cwd: string = REPO_ROOT, noreply?: string): Promise<{ ok: boolean; email?: string; log: string }> {
  let email = noreply;
  if (!email) {
    const u = await sh('gh', ['api', 'user', '--jq', '"\\(.id)+\\(.login)@users.noreply.github.com"'], { cwd });
    if (!u.ok) return { ok: false, log: 'Couldn\'t look up your GitHub no-reply address. Sign in with gh auth login first.\n' + u.stderr };
    email = String(u.stdout).trim();
  }
  const addr: string = email;
  const old = (await sh('git', ['config', 'user.email'], { cwd })).stdout.trim();
  const set = await sh('git', ['config', 'user.email', addr], { cwd });
  if (!set.ok) return { ok: false, log: set.stderr };
  // The oldest commit not on GitHub yet that used the old address: re-save from there. Everything before it (like
  // TeamHub's own commits from an update) stays exactly as it is.
  const pending = await sh('git', ['rev-list', '--reverse', '--format=%H %ae', '--no-commit-header', '@{u}..HEAD'], { cwd });
  const first = old && pending.ok ? String(pending.stdout).split('\n').map((l: string) => l.split(' ')).find(([, ae]: string[]) => ae === old)?.[0] : undefined;
  if (first) {
    const script = `if [ "$(git log -1 --format=%ae)" = "${old}" ]; then git commit --amend --no-edit --reset-author --allow-empty -q; fi`;
    const base = (await sh('git', ['rev-parse', '--verify', '-q', `${first}^`], { cwd })).stdout.trim();
    const rb = await sh('git', ['-c', `user.email=${email}`, 'rebase', '-q', '--rebase-merges', ...(base ? [base] : ['--root']), '--exec', script], { cwd, timeout: 120_000 });
    if (!rb.ok) {
      await sh('git', ['rebase', '--abort'], { cwd });
      return { ok: false, email, log: rb.stdout + rb.stderr };
    }
  }
  return { ok: true, email, log: `Using ${email} for this folder.` };
}
