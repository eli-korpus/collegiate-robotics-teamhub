/** Prints the GitHub Release title and notes for a version (used by .github/workflows/release.yml). */
import { readFileSync } from 'node:fs';
import { hasSecuritySection, notesFor } from '@teamhub/generator';

const version = (process.argv[2] ?? '').replace(/^v/, '');
const body = notesFor(readFileSync('docs/CHANGELOG.md', 'utf8'), version);
if (!body) {
  console.error(`docs/CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
if (process.argv.includes('--title')) console.log(`TeamHub v${version}${hasSecuritySection(body) ? ' (security update)' : ''}`);
else console.log(`${body}\n\n**How to update:** run \`npm run setup\` on your computer and choose **Update**. Details: [docs/updating.md](https://github.com/${process.env.GITHUB_REPOSITORY ?? 'elikorpus/teamhub-ftc'}/blob/main/docs/updating.md).`);
