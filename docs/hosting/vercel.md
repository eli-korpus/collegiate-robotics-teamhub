# Hosting on Vercel

The wizard writes `vercel.json` into your fork:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/dashboard/dist",
  "framework": null,
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The rewrite makes refreshing `/calendar` work.

## Steps

1. Sign in at [vercel.com](https://vercel.com) with GitHub (the free **Hobby** plan is enough for a team).
2. **Add New…** > **Project** > **Import** your TeamHub fork.
3. Leave **Framework Preset** as *Other* and the root directory as `./`. Build settings are read from `vercel.json`.
4. Click **Deploy**.
5. Copy the `.vercel.app` URL and paste it into the wizard's **Host it** step.

## Custom domain

Project > **Settings** > **Domains** > **Add**. Then update the URL in the wizard.
