# Changelog

All notable changes to TeamHub FTC. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): fixes only.
- **Minor** (1.x.0): new features and new tabs. Database changes only add things, so updating is routine.
- **Major** (x.0.0): may remove or rename things. Comes with an upgrade guide in `docs/upgrading/`.

Releases with a **Security** section fix a vulnerability. Update as soon as you can.

How to update your dashboard: [docs/updating.md](updating.md).

## [Unreleased]

### Fixed

- Checkbox lists ran together on one line: People > Request info ("Which fields?"), Skills ("Learn these first"),
  and the setup wizard's New Season and Update screens now show one item per line.

### Changed

- The browser-tab icon (favicon) made from your logo has rounded corners: a solid square logo fills it edge to
  edge, and a logo with a transparent background sits on a white rounded tile. Re-upload your logo in the setup
  wizard (Edit > Program) to update an existing one.
- With the Calendar tab on, attendance is taken for calendar events instead of separate practices: the Attendance
  tab's **Take attendance** lists this week's practices and events from the calendar (or offers to add one), and
  every event except deadlines (practices, meetings, competitions, outreach, socials) has a Take attendance button.
  Repeating events, cancelled dates and moved times are handled.
- Calendar competitions belong to one team (two teams at the same event = two calendar events) and are picked from
  that team's FTCScout schedule instead of typing a code. They link to **Results & matches** (Events) and **Open
  Competition Day**, and each team can have a competition on the calendar only once.

## [1.0.0] - 2026-10-05

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
- Positions are either for the whole program or "each team has its own" (every team can have its own holder).
- Lists (platforms, categories, tags, sizes, time slots, answer choices) are edited as tags with an Add button, and
  anything typed in a "type, then Add" box is added when you click away.
- Social Media Planner works with a single platform (like Instagram) without asking where each post goes.
- Setup wizard: season picker, a light/dark preview that switches the whole preview, clearly optional tool links,
  position pickers for To Manufacture methods, and options that only show when they apply.
- Tool links (code repository, portfolio, CAD…) can be one for the whole program or one per team.
- Tool links are kept private: the setup wizard saves them only in the team's database, never in the settings file
  that is public on GitHub.
- Required fields are checked in every setup step and Save button ("Please fill this in."), and optional fields all
  show the same "Optional" tag.
- Setup wizard: Publish explains upload problems in plain language with one-click fixes (private no-reply email,
  getting newer changes first) and only reports success when GitHub accepted the upload.
