# Hosting your dashboard

Your dashboard is a static website built from your GitHub fork. You connect the fork to a free host once; after that,
every push (including the ones the setup wizard makes) rebuilds and republishes it automatically.

| Host | Free tier | Good when | Guide |
|---|---|---|---|
| **Cloudflare** | Generous, no bandwidth limit | You want the fastest default choice | [cloudflare.md](cloudflare.md) |
| **Vercel** | Hobby plan | You already use Vercel | [vercel.md](vercel.md) |
| **Netlify** | Starter plan | You already use Netlify | [netlify.md](netlify.md) |
| **GitHub Pages** | Free for public repos | You want everything in GitHub | [github-pages.md](github-pages.md) |

Every host uses the same build:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dashboard/dist` |
| Node version | 20.19 or newer (22 or 24 recommended) |
| Environment variables | none: the public Supabase URL and publishable key are in `team/teamhub.config.json` |

![The wizard's Host it step](../screenshots/wizard-host.png)

The wizard's **Host it** step writes the one config file your host needs (for example `wrangler.jsonc` or
`netlify.toml`) into your fork and commits it.

## After the site is live

1. Copy your site's URL (e.g. `https://example-robotics.pages.dev`).
2. Paste it into the wizard's **Host it** step. The wizard updates Supabase's **Site URL** and **Redirect URLs**
   (so login links point at your site, not `localhost`) and checks that the site responds.
3. Share the join link (`<your site>/join`) or print the one-page "How to join" sheet with a QR code.

## Custom domain

All four hosts support a custom domain (e.g. `hub.exampleRobotics.org`) from their dashboard. After adding it, run
`npm run setup` > **Edit** > **Hosting** and paste the new URL so Supabase accepts logins from it.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Blank page or 404 after refreshing a page like `/calendar` | The host isn't sending every path to `index.html` | Make sure the wizard's host file is committed (`wrangler.jsonc`, `vercel.json`, `netlify.toml`, or the Pages workflow) |
| Login or password-reset links go to `localhost` | Supabase Site URL still points at your computer | Wizard > Edit > Hosting > paste your live URL |
| "Database update available" banner | You synced your fork and new tab versions need DB changes | Run `npm run setup` > **Update** on your computer |
| Build fails with "run npm run setup" | `team/teamhub.config.json` isn't in the fork | Finish the wizard's **Publish** step, or commit `team/` yourself |
| The site works but data never loads | Your Supabase project is paused (free projects pause after 7 days idle) | Restore it in the Supabase dashboard, and make sure the keep-alive workflow is enabled (Actions tab) |

## Manual fallback

Run `npm run build` on your computer and upload `dashboard/dist` by drag-and-drop to Cloudflare or Netlify. This
works, but you'll have to repeat it after every change. Prefer a Git-connected deploy.
