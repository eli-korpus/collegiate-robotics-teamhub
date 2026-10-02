# Releasing TeamHub (maintainers)

Teams update with `npm run setup` > Update, which merges a **release tag** into their fork. So everything a team gets
must be in a tagged release, and every release must upgrade cleanly from the one before.

## Versions

TeamHub follows [Semantic Versioning](https://semver.org/). The version lives in the root `package.json` and is built
into every dashboard (admins see "This site runs 1.2.0").

| Bump | When | Database rule |
|---|---|---|
| **Patch** 1.2.**x** | Bug fixes only | Add-only migrations |
| **Minor** 1.**x**.0 | New features, new tabs, new settings | Add-only migrations |
| **Major** **x**.0.0 | Anything that removes or renames something teams rely on | May include contract migrations (below), plus an upgrade guide |

## Every change: update the changelog

Add a line under `## [Unreleased]` in `CHANGELOG.md` in the same pull request, in the right section: **Added**,
**Changed**, **Fixed**, **Removed** or **Security**. Write it for team admins, not developers ("Polls can be edited
until someone answers", not "add poll_edit_guard trigger").

## Cutting a release

```sh
git switch main && git pull
npm run release -- minor          # or patch / major; add --dry-run to preview
git push && git push --tags
```

`npm run release` checks you're on a clean `main`, runs typecheck, lint and tests, bumps `package.json`, moves the
Unreleased notes under the new version, commits `Release vX.Y.Z` and creates the tag.

Pushing the tag runs `.github/workflows/release.yml`, which:

1. checks the tag matches `package.json`,
2. runs typecheck, lint and all tests,
3. runs the **upgrade test from the previous release** (installs the previous tag's database, adds data, upgrades to
   this release, checks the data survived),
4. publishes the GitHub Release with the changelog notes. Releases with a **Security** section get
   "(security update)" in the title, which makes dashboards and the weekly fork check show it as urgent.

After that, admins' dashboards show the update within a day, and forks with the weekly check get an issue.

## Database changes across versions

Teams update their site and database at slightly different times, and can undo an update. So:

- **Patch and minor releases are add-only:** new tables, nullable columns, new functions and policies. Never drop,
  rename or change a column's type, and never edit a migration that has shipped. `npm run lint` enforces this.
- **Removing things takes two releases ("expand, then contract"):**
  1. In a minor release, add the new thing and stop using the old one (code reads the new column, writes both if
     needed, and a migration copies old data across).
  2. In the next **major** release, remove the old thing in a migration whose first line is
     `-- teamhub:contract (why)`. Only then does the linter allow `drop`, `rename` or type changes.
- A major release must ship `docs/upgrading/vN.md` (see the template in `docs/upgrading/README.md`). The wizard links
  to it and asks admins to confirm they read it before a major update.

## Security fixes

- Report vulnerabilities privately (see `SECURITY.md`). Fix in a private
  [security advisory](https://docs.github.com/en/code-security/security-advisories) fork if it's serious.
- Release as a patch with a `### Security` section in the changelog. Describe the impact and that teams should update
  now, without a recipe for exploiting it.
- Publish the advisory after the release is out.

## Checklist before tagging

- [ ] CI is green on `main` (module matrix, smoke and accessibility tests).
- [ ] `CHANGELOG.md` Unreleased section describes every user-visible change.
- [ ] New migrations are add-only (or a major release with contract migrations and an upgrade guide).
- [ ] `AGENTS.md` and docs still match how things work.
- [ ] For big changes: the release QA checklist in `docs/testing.md` against a real Supabase project.
