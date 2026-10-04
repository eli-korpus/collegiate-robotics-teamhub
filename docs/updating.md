# Updating your dashboard

TeamHub gets new features and fixes over time. Your dashboard doesn't change until you choose to update, and you can
undo an update.

## How you'll know there's an update

- **In your dashboard:** admins see a notice at the top of **Admin**, and a dot next to Admin in the sidebar.
  Security updates are shown in red. Update those as soon as you can.
- **On GitHub (optional):** if you turned on "Check once a week for TeamHub updates" in the setup wizard, your fork
  gets an issue titled "TeamHub X is available", and GitHub emails you about it.
- **Release notes:** every version is listed on the
  [TeamHub releases page](https://github.com/elikorpus/teamhub-ftc/releases) and in `docs/CHANGELOG.md`.

Version numbers tell you how big an update is: **1.0.x** is fixes, **1.x.0** is new features, and **2.0.0** is a
major update with an upgrade guide.

## How to update (about 5 minutes)

1. On your computer, open your TeamHub folder and run `npm run setup`.
2. Click **Update**. You'll see what's new, and any warnings (security fixes, major updates, files your team changed).
3. Click **Update to …**. The wizard:
   1. backs up all your data to your computer,
   2. gets the new version straight from TeamHub,
   3. installs it and restarts itself (the page reconnects on its own),
   4. updates your database and server functions,
   5. test-builds your site,
   6. publishes it. Your host rebuilds the site in a minute or two.

Your live site keeps running the old version until the very last step, so people can keep using it while you update.

> **Don't use GitHub's "Sync fork" button for TeamHub updates.** Its "Discard commits" option deletes your team's
> settings, and syncing on GitHub updates your site *before* your database. If you already synced, open the wizard's
> Update screen and use **Already updated the code another way? > Update the database**.

## If your team changed TeamHub's code

Updates keep your changes. Before updating, the wizard lists the TeamHub files your team changed, and shows your
`CUSTOMIZATIONS.md` if you keep one (a short list of what you changed and why; your AI assistant adds to it too).

If an update changes the **same lines** your team changed, the wizard stops before changing anything and lists the
files. You can then either:

- **Ask an AI assistant to combine them:** the wizard gives you a ready-made prompt. The assistant merges the update,
  keeps your changes, and runs the checks. Then run `npm run setup` > Update again to finish.
- **Undo your change** to those files (or ask whoever made it), then update again.

## Undo an update

In the wizard's Update screen, click **Undo this update**. It puts your site's code back to the previous version and
publishes it. Your data stays: database updates only ever *add* things, so the older version works with the updated
database. To update again later, just update as usual.

## If your site breaks right after an update

The fastest fix is your host's "roll back" button, which puts the previous build back online in seconds while you
figure out what happened:

| Host | Where |
|---|---|
| Cloudflare | Workers & Pages > your project > **Deployments** > the previous deployment > **Rollback** |
| Vercel | Your project > **Deployments** > the previous deployment > **⋯** > **Instant Rollback** |
| Netlify | Your site > **Deploys** > the previous deploy > **Publish deploy** |
| GitHub Pages | Your fork > **Actions** > the previous successful "Deploy TeamHub to GitHub Pages" run > **Re-run all jobs** |

A host rollback is temporary: the next push publishes the newest code again. To stay on the old version, also use
**Undo this update** in the wizard. Please [open an issue](https://github.com/elikorpus/teamhub-ftc/issues) describing
what broke.

## Major updates

Major versions (2.0.0, 3.0.0…) can change how things work. The wizard flags them and links to the upgrade guide
(`docs/upgrading/`), and asks you to confirm you've read it. The update still backs up your data first.

## Updating by hand (advanced)

```sh
git remote add teamhub-releases https://github.com/elikorpus/teamhub-ftc.git   # once
git fetch teamhub-releases --tags
git merge v1.2.0          # the version you want
npm install
npm run setup             # Update > Already updated the code another way? > Update the database
git push
```
