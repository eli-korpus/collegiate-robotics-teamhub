# Hosting on GitHub Pages

GitHub Pages needs a small workflow to build the site. The wizard writes `.github/workflows/pages.yml` into your fork;
it runs `npm run build`, copies `index.html` to `404.html` (so refreshing `/calendar` works) and publishes
`apps/dashboard/dist`.

## Steps

1. In your fork on GitHub: **Settings** > **Pages** > **Build and deployment** > **Source**: **GitHub Actions**.
2. Open the **Actions** tab. If GitHub asks, click **I understand my workflows, go ahead and enable them**.
3. Push any change (the wizard's **Publish** step does this), or run **Deploy TeamHub to GitHub Pages** manually from
   the Actions tab with **Run workflow**.
4. When it finishes, the URL is shown on the workflow run and in **Settings** > **Pages**
   (e.g. `https://example-robotics.github.io/example-robotics-teamhub/`).
5. Paste that URL into the wizard's **Host it** step.

### Project pages vs. user pages

A project page lives under a path named after your repository (e.g. `/example-robotics-teamhub/`). The wizard sets `hosting.basePath` in your config so links and
assets work under that path. With a custom domain the base path is `/` again. Update the URL in the wizard after
adding the domain.

## Custom domain

**Settings** > **Pages** > **Custom domain**. Then update the URL in the wizard.

## Limits

GitHub Pages is free for public repositories. Your config only contains public values (the Supabase URL and
publishable key), so a public fork is safe: the database is protected by row-level security, not by hiding the URL.
