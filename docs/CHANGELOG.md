# Changelog

All notable changes to TeamHub FTC. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): fixes only.
- **Minor** (1.x.0): new features and new tabs. Database changes only add things, so updating is routine.
- **Major** (x.0.0): may remove or rename things. Comes with an upgrade guide in `docs/upgrading/`.

Releases with a **Security** section fix a vulnerability. Update as soon as you can.

How to update your dashboard: [docs/updating.md](updating.md).

## [Unreleased]

### Added

- Positions can be **Whole program** (one person covers every team) or **Each team has its own** (every team can have
  its own holder, who only acts for that team). Replaces picking one exact team, which blocked using the same position
  name on several teams. Run `npm run setup` > Update to add it to your database.
- Social Media Planner: list just one platform (like Instagram) and posts go there automatically, without asking.

### Changed

- Lists you type (social platforms, inventory categories, notebook tags, merch sizes, poll time slots, form answer
  choices) use tags with an Add button instead of one comma-separated box. Pasting a comma-separated list still works.
- Anything typed in a "type, then Add" box is added when you click away, with a reminder while it is waiting.
- To Manufacture methods have column headers and an explanation, and you pick who handles each method by position
  name instead of typing ids.
- Selected options in switches (like Whole program / Each team has its own) are easier to see.
- Examples use made-up names and numbers.

### Fixed

- Missing styles: since v1.0.0 parts of the dashboard and the setup wizard lost their styling, and the setup wizard's
  tab **Details** windows and **Start over** confirmation opened off-screen, so the buttons seemed to do nothing.
  Checkboxes also showed stray check marks and dropdowns a row of arrows.
- Setup wizard: the preview's light/dark switch now changes the whole preview, not just the text.
- Setup wizard: the season is now picked from a list (last, this or next season) instead of typed, with a clearer
  explanation that seasons are named by their years, not the game's name.
- Dropdown menus showed a repeating row of arrows; their options now read normally ("Month", not "month").
- Setup wizard > Tab options: Attendance's "Code changes every (seconds)" only shows while self check-in is on.

## [1.0.0] - 2026-10-04

### Added

- Setup wizard (`npm run setup`): teams, branding, 28 optional tabs, permissions, Supabase setup with a live Data API
  check, admin account, publishing, hosting on Cloudflare, Vercel, Netlify or GitHub Pages, keep-alive, backups,
  new season, and Edit mode with a preview of every change.
- Dashboard: Home, People (approvals, positions, changing teams, editing profiles, Request info), Admin (storage,
  tabs, admins, season, tool links, keep-alive, AI assistant prompt).
- 28 tabs: Calendar, Attendance, Announcements, Bulletin Board, Tasks, Polls & Availability, Sign-up Sheets,
  Skills & Training, Paperwork Tracker, Engineering Notebook, To Manufacture, Parts Inventory, Purchase Requests,
  Battery Tracker, Repair & Issue Log, Driver Practice, Code Hub, Events & Results, Competition Day, Scouting,
  Checklists, Judging Prep, Rules Reference, Outreach Log, Sponsors CRM, Media Gallery, Social Media Planner,
  Merch & Orders.
- `AGENTS.md` guide for AI coding assistants.
- **Who can join:** optionally limit sign-ups to email addresses at your school's or organization's domains (setup wizard >
  People, or Admin > Who can join), and allow specific addresses such as a mentor's personal email. Enforced by the
  database.
- "We're using TeamHub" sign-up form (README and the setup wizard's last screen) and a public list of teams using
  TeamHub (`docs/TEAMS.md`), filled in automatically from FTCScout.
- Credit: "made by FTC Team 23208" on the login page, an About card in Admin > Help, and the setup wizard's last screen.
- Home greets people with more variety: greetings change with the time of day, the day of the week and the date
  ("Rise and build", "Happy Friday", "Working late"), and stay the same through each part of the day.
  With the Events tab on, Home also counts down the week before a competition ("3 days to the qualifier",
  "Qualifier tomorrow", "Competition day").
- Update system: an "Update available" notice for admins (Admin page and sidebar), a one-button **Update** in the
  setup wizard (backup, get the new version, update the database, build, publish), an **Undo update** button, and an
  optional weekly GitHub check that opens an issue when a new version is out.
- Before updating, the wizard lists TeamHub files your team changed, and stops with a clear explanation if an update
  conflicts with them. Teams can record their changes in `CUSTOMIZATIONS.md`.
- Release tooling for maintainers: `npm run release`, a release workflow that runs an upgrade test against the
  previous version and publishes the GitHub Release, and `.github/SECURITY.md`.
- Guides: `docs/updating.md` (including rolling back on each host) and `docs/releasing.md`.
- Signed-out visitors can only reach the keep-alive ping and the sign-up page's email rule: every table and every
  other database function is closed to them, on top of row-level security.
