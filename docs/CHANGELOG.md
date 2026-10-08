# Changelog

All notable changes to TeamHub FTC. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
versions follow [Semantic Versioning](https://semver.org/):

- **Patch** (1.0.x): fixes only.
- **Minor** (1.x.0): new features and new tabs. Database changes only add things, so updating is routine.
- **Major** (x.0.0): may remove or rename things. Comes with an upgrade guide in `docs/upgrading/`.

Releases with a **Security** section fix a vulnerability. Update as soon as you can.

How to update your dashboard: [docs/updating.md](updating.md).

## [Unreleased]

### Security

From a full security check of the dashboard, database, server functions, setup wizard and GitHub workflows. Update
with `npm run setup` > **Update** so your database gets the fixes.

- The author of a post, request, notebook entry, scouting entry and so on can no longer be changed from the website.
  Before, someone could make their own post look like another person wrote it (or hand them edit rights to it).
- Only admins can edit an admin's profile. Before, a mentor on the same team could rename an admin.
- Links, purchase requests, print jobs, repairs, albums, outreach events, social posts and driver practice runs can
  only be moved to a team where you're allowed to post them. Before, being on the other team was enough. Badges can
  only be moved to a team where you manage positions.
- The dashboard refuses to run inside another website's frame, so it can't be used for clickjacking. Cloudflare,
  Netlify and Vercel also send headers for this (`dashboard/public/_headers`; new Vercel setups get them in
  `vercel.json`).
- SVG logos are cleaned when they're uploaded and every time the site is built: scripts, event handlers and outside
  links are removed, and logos are served with a policy that lets nothing in them run.
- Attendance check-in codes use a secure random generator, and a code lasts at most 5 minutes.
- Asking to delete your account notifies mentors at most once a day.
- The storage cleanup function compares its secret in constant time.
- The leftover Request info status check is closed.

### Fixed

- The browser test for editing someone's profile uses the First name and Last name boxes.

## [1.0.8] - 2026-10-08
### Added

- **Setup assistant** on everyone's Home: "You're 60% finished setting up your profile", counting your first and last
  name and the profile fields you're asked for, with a button to My profile. It hides once everything is filled in.
- Tool links have a new kind, **Other**, for links that don't fit the others. Add as many as you like in Admin > Tool
  links; they show in Team tools on Home.
- Calendar: **Un-cancel this date** brings back a cancelled date of a repeating event. Whoever can edit the event can
  do it.

### Changed

- Names are two boxes everywhere, **First name** and **Last name** (Join, My profile, editing someone in People, and
  the wizard's admin account). They're still saved as one name, so nothing needs updating.

### Removed

- **People > Request info** and its "Info requested from you" Home card, replaced by the Setup assistant. To collect
  something like shirt sizes, add a profile field (Admin > Profile fields). The "Request info from members"
  permission is gone too. Old requests are cleared when you update.
- The "Not pinned" choice for tool links: those links showed up nowhere. Updating removes any you have, unless you
  have (or had) the Bulletin Board tab, where links without a kind are the board's own links.

## [1.0.7] - 2026-10-06
### Security

- The setup wizard forgets a Supabase access token as soon as Supabase rejects it (expired or deleted), instead of
  keeping it on your computer, and the wizard home asks for a new one. The wizard now explains how long to make the
  token (30 days, never "Never") and how to replace it ([docs/setup-wizard.md](setup-wizard.md)).
- Email confirmation can no longer be turned on without an email provider. Applying settings (Edit, Update) and
  saving the site address used to trust the email setting alone; on a Supabase project with no provider (for example
  after Import into a new project) that stopped new members from joining. Confirmation now stays off, and the wizard
  says why.

### Added

- The setup wizard home now has everything from the last setup page: links to your dashboard, Supabase project and
  GitHub copy, the invite message with its QR code and printable "How to join" page, the AI assistant prompt, and
  the "tell us you're using TeamHub" form.
- Edit > Review & apply shows a green "All done" message when all three steps worked, with a **Back to wizard home**
  button below it. The Update dialog ends the same way.

### Changed

- Once setup is complete, the wizard always opens on its home page. An unfinished edit is offered there (Continue
  editing or Discard) instead of reopening by itself.
- **Back to wizard home** only asks you to discard edits when there are changes that haven't been applied.
- Profile fields in the wizard label each choice: "Who can see it" for the dropdown and "Who fills it in" for the
  checkboxes.
- Required and optional fields are marked consistently: the merch size is required before ordering, the driver in
  Driver practice and the email sender name are marked optional, and the new season label in the wizard is checked
  before starting.
- The email provider form checks the sender address the same way Supabase does, so a mistake shows a clear message
  instead of an error from Supabase.
- The change list in Review & apply now also counts team numbers, dark-mode logos, the second color, who can join and
  tab order, so those edits can always be applied.

## [1.0.6] - 2026-10-06
### Added

- Link previews: sharing your site's link in Discord, iMessage, Slack, WhatsApp, Teams or social media shows your
  logo, program name and a short description. The setup wizard makes the preview picture from your logo, next to the
  browser-tab icon. Sites without a logo show a TeamHub picture. If your site already has a logo, its icon is used
  until you upload the logo again in the wizard (Edit > Your program), which makes the full-size picture.
- Setup wizard > Email now connects your email provider (SMTP) itself: pick Brevo, Gmail, Resend or your school's
  server and fill in the details. The password goes straight to Supabase and is never saved in your files. New guide:
  [docs/email.md](email.md).

### Changed

- The GitHub workflows the setup wizard installs (GitHub Pages deploy, keep-awake and update check) use the current
  GitHub Actions versions, which run on Node.js 24. GitHub is retiring the Node.js 20 versions they used.
- The setup wizard only turns email on once an email provider is saved. Before, turning it on without one stopped new
  members from joining (their confirmation email couldn't be sent).

### Fixed

- With email turned on, the Join page showed nothing after someone signed up. It now says to check their email (and
  tells them if the address already has an account), and the confirmation link brings them back to your site.
- Signing in before confirming your email now explains what to do and offers to send the link again.
- The "Set a new password" page no longer says the link must come from a mentor when it came by email.

## [1.0.5] - 2026-10-06
### Added

- A welcome tour of your dashboard: on someone's first visit it walks through the tabs your team chose (grouped like
  the sidebar, with what each one is for), then People, your profile and everyday shortcuts. It can be taken again
  any time from the menu under your name, or from Admin > Help.
- The TeamHub version your site runs now shows at the bottom of the menu under your name and in the Admin page
  header.

### Changed

- Home only shows cards with something real in them. "Attendance today" (was "Practice today") appears when there's
  attendance to take or continue today, not as a standing "Start taking attendance" button; Up next, recent notebook
  entries, Team tools and Recent activity hide when empty instead of saying "Nothing yet", and the "Today & this
  week" heading hides when none of its cards have anything. Empty Skills, Tasks and Outreach sections on profiles
  hide too.

### Fixed

- Updating TeamHub stopped right after the backup for copies whose `package-lock.json` had been changed (for example
  by committing it after an install): git reported a conflict in that file. The update now takes the new release's
  copy, since npm writes that file and installing the update rewrites it anyway.
- The setup wizard's page no longer reloads by itself when an update replaces the wizard's own files, so update
  progress and any error message stay on screen.

## [1.0.4] - 2026-10-06
### Security

- Links people save (tool links, vendor pages, sponsor websites, notebook and manufacturing links…) are checked before
  they are shown: only web, email and phone links work, so a saved "javascript:" link can no longer run code for
  whoever clicks it. A test now checks every link in the app, and another checks that every database table has
  access rules and is closed to signed-out visitors with all tabs on.

### Added

- Profile fields can be asked of members, captains and/or mentors only (setup wizard > People, or Admin > Profile fields
  for fields added there). By default mentors aren't asked for a grade, subteam, shirt size or emergency contact: those
  fields don't appear on their profile form, Request info doesn't ask them, and they don't count as "missing".

### Changed

- Setup wizard: every action that changes your database or website (building or updating the database, test builds,
  uploading to GitHub, updating TeamHub, backups, imports, a new season, the email setting) shows a live checklist of
  its steps: which one is running, what finished, and where it stopped if something failed. When it works the button
  turns green with a check, and a "Next:" line says what to do now. After a new season or an email change, the dialog
  offers to publish right away.
- Updating TeamHub also uploads `package-lock.json` when installing changed it, so it never blocks the next update.

### Fixed

- Setup wizard: discarding an edit where you uploaded a logo now puts the old logo and browser-tab icon back, so the
  discarded logo is never published by mistake.
## [1.0.3] - 2026-10-06
### Fixed

- Setup wizard: Review & apply shows all three steps from the start (Apply to database, Test build, Commit & push).
  The test build starts by itself after the database step, and Commit & push, which puts the change on your
  website, no longer stays hidden until then.
- After updating, `package-lock.json` showed as changed (its version number lagged behind), which blocked the next
  update until it was committed. Releases now update it too.

## [1.0.2] - 2026-10-06
### Fixed

- A new browser-tab icon (favicon) now shows right after publishing: its link carries a version, so browsers stop
  using the old one they saved.
- Setup wizard: the list of changes before applying now says when the program logo and browser-tab icon change.
- Setup wizard: some steps (Permissions especially) let you keep scrolling into empty space far past the end of the
  page. Every scrolling area now keeps its contents inside it, in the wizard and the dashboard.
- Setup wizard: things saved on your computer but not yet on your website (a new logo or browser-tab icon, the email
  setting, host or keep-alive files, uploads that didn't finish) used to be stuck when Review said "No changes yet".
  The wizard's home screen, Review & apply and the last setup screen now list them with a **Publish to your website**
  button.

### Changed

- Icons match the text they sit next to (sidebar, menus, search, card titles, links), and icon-only buttons (the
  bell, settings, edit, delete, close) are all the same grey and turn white on hover. Before, some were white and
  some grey, a few delete buttons were red, and some turned red or blue on hover.

## [1.0.1] - 2026-10-06
### Added

- Tool links (code repository, portfolio, CAD…) can be one for the whole program or one per team.
- Tool links are kept private: the setup wizard saves them only in the team's database, never in the settings file
  that is public on GitHub.
- Required fields are checked in every setup step and Save button ("Please fill this in."), and optional fields all
  show the same "Optional" tag.
- Setup wizard: Publish explains upload problems in plain language with one-click fixes (private no-reply email,
  getting newer changes first) and only reports success when GitHub accepted the upload.
- Setup wizard: the Teams step asks whether you have one team or several, and per-team options only appear when
  you have several teams.
- People can be on several subteams: Subteam is a multi-choice field (existing single answers keep working), and the
  People filter finds someone in any of their subteams.
- An **Edit** button on someone's profile (admins, and people who manage that team) opens one window for their name,
  teams and roles, and profile fields such as subteams and shirt size.
- Profile fields have three visibility levels, chosen per field in the setup wizard: the whole program, team leaders
  (the person, their captains and mentors, admins) or mentors only. Shirt size and dietary needs now default to team
  leaders, so other students can't see them. Captains and mentors get the new "See team-only profile fields"
  permission. Changing a field's level moves the existing answers when you apply it (database update required).
- **Admin > Profile fields**: see every profile field and who can see it, and add, rename or remove extra fields
  (typed or pick-from-a-list, with their own visibility) without opening the setup wizard.
- Admin > Help lists what you can change right in the dashboard and what needs the setup wizard.

### Fixed

- Home left empty gaps between cards of different heights. Cards now fill the shortest column first (no holes),
  and the Today cards stretch to fill their row.
- Team-specific tool links no longer repeat the team (for example "Portfolio (12345) (A)") when the link's name
  already says which team it is.
- Checkbox lists ran together on one line: People > Request info ("Which fields?"), Skills ("Learn these first"),
  and the setup wizard's New Season and Update screens now show one item per line.
- On phones and tablets, the buttons to delete a comment or a notebook photo were invisible (they only appeared
  on mouse hover). They now always show on touch screens.
- Admin > Help showed a stray "All teams" label.
- Setup wizard: clicking a tab option's description no longer removes its tags, and the Build my database button
  no longer touches Show the SQL.

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
