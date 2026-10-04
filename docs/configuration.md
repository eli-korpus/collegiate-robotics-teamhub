# Configuration (`team/teamhub.config.json`)

Everything that makes a dashboard *yours* lives in one JSON file in your fork, `team/teamhub.config.json`, plus your
logos in `team/branding/`. The setup wizard (`npm run setup`) writes both. You normally never edit them by hand. This
page documents the format for when you want to look, review a change in a pull request, or fix something manually.

The file is validated by `packages/config-schema` (zod) every time the app is generated or built.

> **Everything in this file is public.** It contains your Supabase project URL and *publishable* key, which are meant
> to be shipped to browsers. Your data is protected by row-level security in the database. Never put the service-role
> key, a personal access token, or your database password in it. The wizard keeps those in memory or in
> `~/.teamhub/credentials.json` on your computer only.

## Top level

| Key | Type | What it is |
|---|---|---|
| `configVersion` | `1` | Format version. |
| `program` | object | `name` (shown in the sidebar and browser tab), `logo` (path under `team/branding/` or null), `multiTeam` (shows the team switcher). |
| `teams` | array (≥ 1) | Each team: `id` (UUID, never change it), `number` (FTC team number or null), `name`, `shortCode` (1–4 chars, e.g. `A`), `color` (hex), `logo`, `logoDark`, `school`, `city`. |
| `theme` | object | `accent` (hex), `secondary` (hex or null), `corners` (`soft`/`sharp`), `defaultMode` (`light`/`dark`/`system`). Accents are automatically adjusted to meet WCAG AA contrast; the generator prints a note when it does. |
| `season` | string | Initial season label like `2026–27`. The live value is in the database and changes with the wizard's **New Season** tool. |
| `modules` | object | Tabs, keyed by id: `{ "state": "active" \| "dormant", "settings": { … } }`. Missing = not installed. See [modules/README.md](modules/README.md). |
| `subteams` | array | `{ id, name }`: one list used by People, Tasks, Notebook and Skills. |
| `positions` | array | `{ id: "pos_…", name, teamId (null = program-wide), grantsPermissions }`. |
| `profileFields` | array | Extra profile fields: `{ id, label, type: "text" \| "select", options, private }`. Private fields are visible only to the person and mentors. A field with id `shirt_size` is used by Merch & Orders. |
| `permissions` | object | Overrides of the default permission matrix: `{ "tasks.assign": { "types": ["captain", "mentor"], "positions": ["pos_lead_programmer"] } }`. Anything missing uses the tab's defaults. Admins always have every permission. |
| `home` | object | `defaults.member/captain/mentor`: ordered widget ids for each profile type's Home page. People can still reorder or hide their own. |
| `nav` | object | `order`: optional explicit sidebar order of tab ids. |
| `toolLinks` | array | Links seeded into the in-app link list on first setup: `{ slot, label, url, section, description }`. Slots like `team_chat`, `drive`, `cad`, `code_repo` let tabs show the right shortcut ("Discuss in Discord"). Edited in the app afterwards. |
| `join.allowedEmailDomains` | string[] | Optional. Only emails at these domains (or their subdomains) can sign up, e.g. `["collegiateschool.org"]`. Empty lets anyone with the join link sign up. Enforced by the database. Admins can change it, and allow specific addresses, in Admin > Who can join; the wizard only writes it when you change it in the wizard. |
| `hosting` | object | `provider` (`cloudflare`/`vercel`/`netlify`/`github-pages`), `url`, `basePath` (`/` unless GitHub project pages). |
| `supabase` | object | `url`, `anonKey` (the publishable key), `projectRef`. |
| `features` | object | `email`: turn on only after configuring custom SMTP in Supabase (enables email confirmation and self-serve password reset). |

## Module states

- **active**: the tab is in the sidebar and its database policies are live.
- **dormant**: the tab is hidden; its tables and files stay, readable by admins only. Switching back to `active`
  restores everything instantly.
- **removed from the file**: after the wizard exports the data, its tables, functions, buckets and integration
  columns are dropped. Only do this through the wizard (Edit > remove tab > "Delete data & free space").

## Editing by hand

1. Edit the file.
2. `npm run generate`: validates the file and regenerates the app. Errors name the exact path, e.g.
   `teams.0.color: Use a 6-digit hex color like #3B82F6`.
3. If you changed `modules`, `positions`, `subteams` or `permissions`, the **database** must be updated too:
   run `npm run setup` > **Edit** > **Apply**. The dashboard shows admins a "needs a database update" banner until then.
4. Commit and push; your host rebuilds.

## Example

[`examples/demo.config.json`](../examples/demo.config.json) enables every tab for two teams.
[`examples/core-only.config.json`](../examples/core-only.config.json) is the smallest valid config.
