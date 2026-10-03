# AGENTS.md

Guide for AI coding assistants (and people) changing this TeamHub FTC dashboard. AI tools like Claude Code, Cursor,
GitHub Copilot, OpenAI Codex and Gemini CLI read this file automatically. If you're a person, the
[prompt at the bottom](#prompt-for-your-ai-assistant) is the easiest way to get help.

## What this is

TeamHub FTC is a team dashboard for *FIRST* Tech Challenge programs. Each team runs its own copy: this repository is a
fork, the database and logins are the team's own Supabase project, and the site is hosted for free (Cloudflare,
Vercel, Netlify or GitHub Pages) from the fork. Users are mostly high-school students and adult mentors.

There are two programs in this repository:

- **The dashboard** (`apps/dashboard`): the website the team uses. It's built from `team/teamhub.config.json` and only
  contains the tabs the team chose.
- **The setup wizard** (`npm run setup`, `apps/wizard`): a local web app that writes the config, sets up and updates the
  Supabase database, and handles hosting. It's the safe way to change most settings.

## Before you change code: can the wizard do it?

Run `npm run setup` and choose **Edit** for any of these. Don't hand-edit code for them:

- adding or removing tabs, and each tab's options
- program name, teams, colors, logos, light/dark default
- subteams, positions, profile fields, permissions (who can do what)
- tool links (also editable in the dashboard: Admin > Tool links)

Day-to-day data (people, teams people are on, events, tasks…) is edited in the dashboard itself.

## Repository map

| Path | What's there |
|---|---|
| `team/teamhub.config.json` | This team's settings. Written by the wizard. Format: `docs/configuration.md`. |
| `team/branding/` | Logos. |
| `apps/dashboard/src/core/` | Home, People, Admin, sign-in and the app shell. |
| `apps/dashboard/src/generated/` | **Generated. Never edit.** Rebuilt from the config by `npm run generate`. |
| `modules/<id>/` | One folder per tab (`modules/tasks`, `modules/scouting`, …). |
| `integrations/<a>+<b>/` | Small features that exist only when both tabs are enabled (e.g. tasks on the calendar). |
| `packages/ui/` | Design system: buttons, inputs, dialogs, lists, calendar, charts. Icons come from Lucide. |
| `packages/sdk/` | Helpers tabs use: data hooks, permissions, team scope, uploads, FTCScout client. |
| `packages/generator/` | Turns the config into generated code and the database plan. |
| `core/migrations/`, `core/policies.sql` | Core database tables and security rules. |
| `supabase/functions/` | Server functions (password reset links, deleting users, storage cleanup, calendar feed). |
| `docs/` | Hosting guides, configuration reference, tab list, testing. |

### Inside a tab (`modules/<id>/`)

| File | Purpose |
|---|---|
| `module.ts` | Name, purpose, settings (zod), permissions, widgets. Permission keys look like `tasks.assign`. |
| `migrations/NNN_name.sql` | Database tables, numbered `001`, `002`, … The count is the tab's database version. |
| `policies.sql` | Row-level security rules. Re-applied on every database update. |
| `cron.sql` | Optional scheduled jobs. |
| `client.tsx` | The small always-loaded part: icon, routes, widgets, search. |
| `ui/` | The screens (React). Most visual changes happen here. |
| `<id>.test.ts` | Database permission tests. |
| `README.md` | What the tab is for and not for. |

## How to make common changes

**Change wording, layout or behavior of a tab:** edit files in `modules/<id>/ui/`. Use components from `@teamhub/ui` and
hooks from `@teamhub/sdk` (`useRows`, `useSupabase`, `useCan`, `useMe`, `useTeamScope`, `TeamScopePicker`,
`ScopeVisibility`, `friendlyError`) so it matches the rest of the app.

**Add a column or table to a tab:**

1. Add a **new** file `modules/<id>/migrations/NNN_short_name.sql` with the next number. Only add things: new tables,
   nullable columns, new functions. Never drop or rename (older copies of the site must keep working).
2. Name every new table, function, policy, index and trigger with the tab's prefix (see `prefix` in `module.ts`).
3. Add row-level security in `modules/<id>/policies.sql`. Use `teamhub_in_team(team_id)` for "can see" and
   `teamhub_can('<tab>.<action>', team_id)` for "can do". Never use `using (true)` for writes.
4. Add a test to `modules/<id>/<id>.test.ts` for who can and can't read and write.
5. Apply it to the real database: `npm run setup` > **Update** (or **Edit** > Apply).

**Add a permission:** add it to `definePermissions` in the tab's `module.ts`, use it in `policies.sql` and with
`useCan` in the UI, then run `npm run setup` > Edit to choose who gets it.

**Add a brand-new tab:** `npm run new-module -- <id> --prefix <abc_> --name "Tab name" --category team|engineering|competition|outreach`,
then enable it with the wizard. Details: `CONTRIBUTING.md`.

**Connect two tabs:** create an integration in `integrations/<a>+<b>/` instead of importing one tab from another
(tabs must never import each other; `npm run lint` checks this).

**Change Home, People or Admin:** `apps/dashboard/src/core/`. Keep these changes small: they're the files most likely to
conflict when you update to new TeamHub releases.

## Rules that keep the dashboard safe and working

- **Keep the credit.** TeamHub was made by FTC Team 23208. The MIT license requires keeping the copyright notice in
  `LICENSE`; please also keep the "made by FTC Team 23208" line on the login page and the About card in Admin > Help.
- **Security is in the database.** Row-level security decides who sees and changes what. Hiding a button is not
  security. Every table must have RLS policies and a test.
- **Never commit secrets.** The Supabase URL and *publishable* key in the config are public on purpose. The service-role
  key, personal access tokens and database password must never be in the repository or the website.
- **Youth protection.** No chat, direct messages or private conversations between users. Discussion links to the
  team's existing chat. Private profile fields are visible only to the person and mentors.
- **Free-tier budget.** Prefer links over files. Uploads go through `<Upload>` (compressed in the browser). Don't store
  big files in the database.
- **Expand-only database changes.** Add, never drop or rename. Never edit a migration that has already been applied.
- **Don't edit generated files** (`apps/dashboard/src/generated/`). Change the config or the generator instead.
- **Keep tabs independent.** A tab you didn't choose adds zero code to the site. Don't import between tabs.
- **Icons come from Lucide** (`lucide-react`). No emojis or hand-drawn icons.
- **Plain, friendly wording** for high-school students. Say who will see what people type.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install everything (first time, and after syncing). |
| `npm run setup` | Open the setup wizard (Edit, Update, Backup, New Season). |
| `npm run dev` | Run the dashboard locally against your Supabase project. |
| `npm run dev:demo` | Run it with the example config (every tab). |
| `npm run typecheck` | TypeScript check. |
| `npm run lint` | Code and SQL rules (tab boundaries, table prefixes, add-only migrations). |
| `npm test` | Unit tests and database permission tests (in-process Postgres). |
| `npm run build:demo && npx playwright test` | Build and open every tab in a browser, with accessibility checks. |

Before you push: `npm run typecheck && npm run lint && npm test` must pass. If you changed SQL, run
`npm run setup` > Update so your live database matches.

## Keep your changes update-friendly

New TeamHub versions are merged into your fork by `npm run setup` > **Update**. Your changes are kept, but if an update
changes the same lines you did, it stops and asks you to combine them. To keep updates painless:

- Prefer **adding** (a new tab with `npm run new-module`, a new integration, a new file) over **editing** TeamHub's files.
- Keep edits to shared files (`apps/dashboard/src/core/`, `packages/`, other teams' tabs) small and few.
- Record every change in **`CUSTOMIZATIONS.md`** at the repository root (what, why, which files). The wizard shows it
  before updating, and it tells an AI assistant what to keep when combining an update with your changes.
- Never edit an existing migration file; add a new one.

## After changing code

1. Run the checks above.
2. If you added migrations or permissions: `npm run setup` > Update or Edit, so the database matches the code.
3. Commit and push. The host rebuilds the site in a minute or two.
4. Add a line to `CUSTOMIZATIONS.md` so you (and the update wizard) remember it.

## Prompt for your AI assistant

Copy this into your AI coding assistant, fill in the last line, and let it read this file first. The setup wizard's
last step and **Admin > AI assistant** in your dashboard show the same prompt with your program name and tabs filled in.

<!-- agent-prompt:start -->
```text
You are helping <your program name>, a FIRST Tech Challenge robotics program, customize our TeamHub FTC dashboard. TeamHub is an open-source React + Supabase web app, and our copy is a fork on GitHub. Many of us are students, so explain things clearly.

Before changing anything:
1. Read AGENTS.md at the root of the repository. It explains how the code is organized and the rules that keep the dashboard working and safe.
2. Read team/teamhub.config.json to see our setup. Our tabs: <your tabs>.

How to work:
- Explain your plan in plain language and wait for my OK before making big changes.
- Make the smallest change that does what we asked. If the setup wizard (npm run setup) can already do it, tell me that instead of editing code.
- Never edit files in apps/dashboard/src/generated/. They are rebuilt from our config.
- Database changes go in a new numbered migration file. Never edit or delete an existing migration. Every table needs row-level security policies.
- Never put secrets (the Supabase service-role key, access tokens, passwords) in the repository.
- Do not add chat or private messages between users (youth protection).
- Use Lucide icons only. No emojis in the interface.
- When you're done, run npm run typecheck, npm run lint and npm test, and fix anything that fails.
- Add a short note about the change to CUSTOMIZATIONS.md (create it if it doesn't exist), so future TeamHub updates go smoothly.
- Tell me which files you changed, whether the database needs updating (npm run setup > Update), and how to undo the change.

What we want to change: <describe the change here>
```
<!-- agent-prompt:end -->
