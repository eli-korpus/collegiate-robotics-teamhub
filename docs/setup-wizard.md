# The setup wizard

Run `npm run setup` in your copy of TeamHub and the wizard opens at `http://localhost:4747`. It runs only on your
computer, saves your progress as you go (you can quit and come back), and shows a live preview of your dashboard on
wide screens. Plan on about 30 minutes.

## 1. Welcome

What you'll need: a GitHub account, a free Supabase account, and about 30 minutes. Everything runs on free plans.

![Welcome step](screenshots/wizard-welcome.png)

## 2–3. Program and teams

Name your program, then add each team. Type an FTC team number and the wizard fills in the team's name from
FTCScout. Each team gets a short code (A, B, …) and a color that marks its items everywhere in the dashboard.

![Teams step](screenshots/wizard-teams.png)

## 4. Look & feel

Pick an accent color (it's automatically adjusted so text stays readable in light and dark mode), the corner style,
the default theme and the season label.

![Look & feel step](screenshots/wizard-look.png)

## 5. Choose tabs

Pick only what your team will use. Presets get you started (**Starter**, **Competitive**, **Everything**), and each
card says what the tab is for, what it stores and roughly how much space it uses. You can add or remove tabs later
without losing data.

![Choose tabs step](screenshots/wizard-tabs.png)

## 6. Tab options

A few choices per tab, such as whether Attendance tracks hours or allows self check-in. The defaults work well.

![Tab options step](screenshots/wizard-options.png)

## 7–8. People, positions and permissions

Set up subteams, positions (like "3D Print Farm Manager" or "Outreach Lead") and extra profile fields. Then decide who
can do what. The **Simple** view shows only the key decisions for each tab; **Advanced** shows everything. Admins can
always do everything.

![Permissions step](screenshots/wizard-permissions.png)

## 9. Tool links

Your team chat, Drive folder, CAD, code repository and other links. Tabs use them to point people to the right place
(for example "Discuss in Discord" under a poll).

## 10. Connect Supabase

Create a free Supabase project and paste a personal access token. The wizard shows exactly what it will create, then
builds your database for only the tabs you picked. The token stays on your computer.

![Connect Supabase step](screenshots/wizard-supabase.png)

## 11–12. Admin account and publish

Create your own admin login, then save your settings to your GitHub copy of TeamHub.

## 13. Host it

Choose Cloudflare, Vercel, Netlify or GitHub Pages and follow the three short steps. Paste your site's address at the
end and the wizard points Supabase logins at it. Detailed guides: [hosting](hosting/README.md).

![Host it step](screenshots/wizard-host.png)

## 14–15. Keep-alive and done

The wizard adds a small GitHub workflow that keeps your free Supabase project from pausing, then gives you a join link
and a printable "How to join" page with a QR code.

## Running it again later

Run `npm run setup` any time. Because your settings already exist, the wizard opens a home screen with:

- **Edit**: change tabs, branding or permissions. It shows a summary of the changes and backs up any tab you remove
  before touching the database.
- **Update**: apply database updates after you sync your copy with the latest TeamHub.
- **Backup & Export**, **New Season**, and a **Danger zone** for removing TeamHub entirely.
