import { chmodSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { explainPushError, publish, sh, useNoreplyEmail } from './git';

const PRIVATE = 'student@gmail.com';
const NOREPLY = '12345+student@users.noreply.github.com';
const git = (cwd: string, ...args: string[]) => sh('git', args, { cwd });

/** A team's copy (with a GitHub copy to push to) that refuses private emails, like GitHub's privacy setting. */
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'teamhub-publish-'));
  const remote = join(dir, 'remote.git');
  const work = join(dir, 'work');
  await sh('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  writeFileSync(
    join(remote, 'hooks', 'pre-receive'),
    `#!/bin/sh\nwhile read old new ref; do\n  if git log --format=%ae "$old..$new" 2>/dev/null | grep -q "${PRIVATE}"; then echo "push declined due to email privacy restrictions" >&2; exit 1; fi\ndone\n`,
  );
  chmodSync(join(remote, 'hooks', 'pre-receive'), 0o755);
  await sh('git', ['clone', '-q', remote, work]);
  await git(work, 'config', 'user.name', 'Student');
  await git(work, 'config', 'user.email', 'teamhub@example.org');
  await git(work, 'checkout', '-q', '-b', 'main');
  writeFileSync(join(work, 'README.md'), 'TeamHub\n');
  await git(work, 'add', '.');
  await git(work, 'commit', '-q', '-m', 'TeamHub');
  await git(work, 'push', '-q', '-u', 'origin', 'main');
  return { work, remote };
}

describe('publishing to GitHub', () => {
  let work: string;
  beforeEach(async () => {
    ({ work } = await setup());
  });

  it('commits the settings and uploads them', async () => {
    mkdirSync(join(work, 'team'));
    writeFileSync(join(work, 'team', 'teamhub.config.json'), '{}');
    const r = await publish('Set up TeamHub', ['team'], work);
    expect(r.ok).toBe(true);
    expect((await git(work, 'rev-list', '--count', '@{u}..HEAD')).stdout.trim()).toBe('0');
    expect((await publish('Set up TeamHub', ['team'], work)).message).toMatch(/Already up to date/);
  });

  it('explains a blocked upload, never claims success on a retry, and the email fix makes it work', async () => {
    // An update from TeamHub (a different author) that isn't uploaded yet: it must stay exactly as it is.
    writeFileSync(join(work, 'CHANGELOG.md'), 'v1.0.1\n');
    await git(work, 'add', '.');
    await git(work, 'commit', '-q', '-m', 'Update TeamHub');
    const update = (await git(work, 'rev-parse', 'HEAD')).stdout.trim();

    await git(work, 'config', 'user.email', PRIVATE);
    mkdirSync(join(work, 'team'));
    writeFileSync(join(work, 'team', 'teamhub.config.json'), '{"program":{"name":"Example Robotics"}}');
    const first = await publish('Set up TeamHub', ['team'], work);
    expect(first.ok).toBe(false);
    expect(first.fix).toBe('email');
    expect(first.problem).toMatch(/private email/);

    // Clicking again: nothing new to commit, but it still tries to upload and reports the real problem.
    const again = await publish('Set up TeamHub', ['team'], work);
    expect(again.ok).toBe(false);
    expect(again.fix).toBe('email');

    const fixed = await useNoreplyEmail(work, NOREPLY);
    expect(fixed.ok).toBe(true);
    expect((await git(work, 'log', '--format=%ae', '-1')).stdout.trim()).toBe(NOREPLY);
    expect((await git(work, 'rev-parse', 'HEAD~1')).stdout.trim()).toBe(update);
    expect((await git(work, 'show', 'HEAD:team/teamhub.config.json')).stdout).toContain('Example Robotics');

    const done = await publish('Set up TeamHub', ['team'], work);
    expect(done.ok).toBe(true);
    expect(done.message).toMatch(/Uploaded/);
  });
});

describe('push errors in plain language', () => {
  it('names the accounts when the wrong one is signed in', () => {
    const r = explainPushError('remote: Permission to eli-korpus/team-teamhub.git denied to elikorpus.\nfatal: ... 403', { login: 'elikorpus', repo: 'eli-korpus/team-teamhub' });
    expect(r.problem).toMatch(/elikorpus.*isn't allowed to change eli-korpus\/team-teamhub/);
    expect(r.fix).toBeNull();
  });

  it('offers to get changes first when GitHub has newer ones', () => {
    expect(explainPushError(' ! [rejected]        main -> main (fetch first)').fix).toBe('pull');
  });

  it('explains signing in and connection problems', () => {
    expect(explainPushError('fatal: could not read Username for https://github.com').problem).toMatch(/gh auth login/);
    expect(explainPushError('fatal: unable to access: Could not resolve host: github.com').problem).toMatch(/internet/);
  });
});
