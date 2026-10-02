# Hosting on Cloudflare

Cloudflare serves the dashboard as **static assets on Workers** (free plan, no bandwidth limit). The wizard writes
`wrangler.jsonc` into your fork:

```jsonc
{
  "name": "example-robotics-teamhub",
  "compatibility_date": "2026-09-01",
  "assets": {
    "directory": "./apps/dashboard/dist",
    "not_found_handling": "single-page-application"
  }
}
```

`not_found_handling: "single-page-application"` is what makes refreshing `/calendar` work.

## Steps

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com) (create a free account if needed).
2. Go to **Workers & Pages** > **Create** > **Import a repository** (Workers tab).
3. Connect GitHub when asked and choose **your fork** of TeamHub.
4. Build settings:
   - **Build command:** `npm run build`
   - **Deploy command:** `npx wrangler deploy`
   - Leave the root directory empty.
5. Click **Deploy**. The first build takes 1–3 minutes.
6. Copy the URL ending in `.workers.dev` and paste it into the wizard's **Host it** step.

> Cloudflare Pages (the older product) also works: framework preset **None**, build command `npm run build`, build
> output directory `apps/dashboard/dist`. Pages serves single-page apps correctly as long as there's no `404.html`.

## Custom domain

Worker > **Settings** > **Domains & Routes** > **Add** > **Custom domain**. Then update the URL in the wizard.
