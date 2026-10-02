/**
 * Cut a TeamHub release (maintainers only):
 *
 *   npm run release -- minor            # or patch / major
 *   npm run release -- patch --dry-run  # show what would happen
 *
 * Checks you're on a clean main branch, runs typecheck/lint/tests, bumps package.json, moves the CHANGELOG
 * "Unreleased" notes under the new version, commits "Release vX.Y.Z" and creates the tag. Then push with
 * `git push && git push --tags`: the release workflow publishes the GitHub Release (see docs/releasing.md).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bumpVersion, cutRelease, hasSecuritySection, notesFor, type Bump } from '@teamhub/generator';

const root = join(import.meta.dirname, '..');
const bump = process.argv[2] as Bump;
const dry = process.argv.includes('--dry-run');
const skipChecks = process.argv.includes('--skip-checks');
const fail = (msg: string): never => {
  console.error(`Error: ${msg}`);
  process.exit(1);
};
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const npm = (script: string) => execFileSync('npm', ['run', script], { cwd: root, stdio: 'inherit' });

if (!['patch', 'minor', 'major'].includes(bump)) fail('Usage: npm run release -- patch|minor|major [--dry-run]');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Releases are cut from main.');
if (git('status', '--porcelain')) fail('Commit or stash your changes first.');

const pkgPath = join(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
const next = bumpVersion(pkg.version, bump);
const today = new Date().toISOString().slice(0, 10);
const changelogPath = join(root, 'CHANGELOG.md');
const changelog = cutRelease(readFileSync(changelogPath, 'utf8'), next, today);
const notes = notesFor(changelog, next);

console.log(`Release v${next} (was v${pkg.version})${hasSecuritySection(notes) ? ' (SECURITY RELEASE)' : ''}\n\n${notes}\n`);
if (dry) process.exit(0);

if (!skipChecks) {
  npm('typecheck');
  npm('lint');
  npm('test');
}
writeFileSync(pkgPath, `${JSON.stringify({ ...pkg, version: next }, null, 2)}\n`);
writeFileSync(changelogPath, changelog);
git('add', 'package.json', 'CHANGELOG.md');
git('commit', '-m', `Release v${next}`);
git('tag', '-a', `v${next}`, '-m', `TeamHub v${next}`);
console.log(`\nCommitted and tagged v${next}. Publish it with:\n\n  git push && git push --tags\n\nThe release workflow then runs the checks and the upgrade test, and creates the GitHub Release.`);
