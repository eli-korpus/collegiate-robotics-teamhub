# Contributing to TeamHub FTC

Thanks for helping FTC teams! TeamHub is built so that **any combination of tabs works** and a tab you don't choose
costs nothing. Every contribution keeps those two promises.

## Getting started

```sh
npm install
npm run dev:demo          # the dashboard with every tab, against examples/demo.config.json
npm run setup             # the setup wizard on http://localhost:4747
```

The dashboard needs a Supabase project to log in. For UI work without one, build the demo and use the Playwright mock:
`npm run build:demo && npx playwright test tests/e2e/smoke.spec.ts --headed`.

Before opening a pull request:

```sh
npm run typecheck && npm run lint && npm test
npm run build:demo && npx playwright test
npm run ci:matrix -- --only core,all --count 2     # optional locally; CI runs the full matrix
```

See [docs/testing.md](docs/testing.md) for what each check does. [AGENTS.md](AGENTS.md) is the short version of these
rules for AI coding assistants; keep it in sync when conventions change.

## Repository map

| Path | What lives there |
|---|---|
| `apps/dashboard` | The static React app teams use. `src/core` holds Home, People, Admin, auth and the shell; `src/generated` is written by the generator (never edit). |
| `apps/wizard` | `npm run setup`: a Hono server (`server/`) + React UI (`src/`). Talks to the Supabase Management API with the user's token, which never leaves their computer. |
| `packages/config-schema` | The zod schema for `team/teamhub.config.json`. |
| `packages/generator` | Reads the config, loads the module catalog, writes `src/generated/*` and the ordered SQL plan. |
| `packages/sdk` | What modules use: `defineModule`, data hooks, permissions (`useCan`), registries, FTCScout client. |
| `packages/ui` | Design system: tokens, primitives, lists, calendar, kanban, charts, file drop. Icons come only from [Lucide](https://lucide.dev). |
| `core/` | Core SQL: people, permissions helpers, links, comments, notifications, storage accounting. |
| `modules/<id>/` | One folder per tab. |
| `integrations/<a>+<b>/` | Behavior that exists only when both tabs are enabled. |
| `supabase/functions/` | Edge functions (admin reset link, delete user, storage cleanup, iCal feed). |

## How to write a module

```sh
npm run new-module -- robot-log --prefix rlog_ --name "Robot Log" --category engineering
```

That scaffolds a working tab you can grow:

```
modules/robot-log/
  module.ts               manifest: id, prefix, purpose, notFor, settings (zod), permissions, widgets, exportTables
  migrations/001_init.sql expand-only DDL (version = number of migration files)
  policies.sql            RLS, re-applied on every plan; may use {{settings.x}}
  cron.sql                optional pg_cron jobs; may use {{settings.x}}
  client.tsx              defineClient('teamhub-module:robot-log', { icon, Routes, widgets, quickActions, search, entities })
  ui/                     lazy-loaded screens
  README.md               purpose, not-for, permissions
  robot-log.test.ts       PGlite RLS tests
```

### The rules

1. **One clear purpose.** Fill in `purpose` and `notFor` (with `goTo` pointing at the tab or core page that *does*
   handle it). If your feature overlaps an existing tab, extend that tab instead.
2. **Prefix everything.** Every table, function, trigger, policy, index and cron job starts with your prefix. Dormant
   and delete find your objects by prefix; `npm run lint` enforces it.
3. **Expand-only migrations.** Add tables and nullable columns; never drop, rename or change types. Teams update their
   site and database at different times, so old code must work with a new database and vice versa.
4. **Never import another module.** Use the registries in `@teamhub/sdk` (`<Slot>`, `quickActions`, `entities`,
   `calendarOverlays`) or write an integration unit. ESLint enforces the boundary.
5. **RLS is the security boundary.** UI checks (`useCan`) are for clarity only. Use `teamhub_can('<id>.<action>',
   team_id)` and `teamhub_in_team(team_id)` in policies, and test both the allowed and the denied path.
6. **Stay small.** The client file is always loaded, so keep it to the icon, lazy imports and tiny callbacks. Each
   route chunk must stay under 60 KB gzip.
7. **Respect the storage budget.** Prefer links over files. Files go through `<Upload>` (compressed in the browser) and
   are deleted via `teamhub_trash()` when their row is deleted.
8. **No chat or private messages** (youth protection). Point discussion to the team's chat with `<TeamChatLink>`.
9. **Icons come from Lucide.** No emojis, Unicode symbols or hand-drawn SVG icons in the UI.
10. **Say who can see things.** Use `<VisibilityNote>` / `<ScopeVisibility>` wherever people enter data.

### Integrations

Need behavior that spans two tabs ("practices on the calendar get a Take attendance button")? Create
`integrations/<a>+<b>/integration.ts` with `defineIntegration({ requires: [a, b], prefix: 'ix_abc_', down })`.
Prefer the **overlay** pattern (read both sides, store nothing). If you must add a column, make it nullable, add it in
`migrations/`, and drop it in `down`.

### Settings

Settings are a zod object; the wizard renders the form from it (`.meta({ title, description })` sets the labels).
Settings reach SQL only through `{{settings.x}}` in `policies.sql` / `cron.sql`, and the browser through
`useModuleSettings('<id>')`.

## Changelog and releases

Add a line for every user-visible change under `## [Unreleased]` in `CHANGELOG.md`. Releases, versioning and the
add-only database rule across versions are described in [docs/releasing.md](docs/releasing.md).

## Style

- TypeScript strict, Prettier (`npm run format`), function components and hooks.
- Plain-English UI copy aimed at high-school students: short, specific, no jargon.
- Accessibility: label every control, keep contrast AA (the theme tokens handle color), test keyboard paths.

## License

By contributing you agree that your contributions are licensed under the MIT License.
