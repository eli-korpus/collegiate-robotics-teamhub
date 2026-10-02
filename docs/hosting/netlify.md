# Hosting on Netlify

The wizard writes `netlify.toml` into your fork:

```toml
[build]
  command = "npm run build"
  publish = "apps/dashboard/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The redirect makes refreshing `/calendar` work.

## Steps

1. Sign in at [app.netlify.com](https://app.netlify.com) with GitHub.
2. **Add new site** > **Import an existing project** > **GitHub** > choose your TeamHub fork.
3. Netlify reads the build settings from `netlify.toml`; leave the fields as they are.
4. Click **Deploy**.
5. Copy the `.netlify.app` URL and paste it into the wizard's **Host it** step.

## Custom domain

Site > **Domain management** > **Add a domain**. Then update the URL in the wizard.

*Screenshots: TODO — console labels above are current as of October 2026 and may move.*
