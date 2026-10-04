import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const htmlPath = resolve(here, 'src/generated/html.json');

interface HtmlMeta {
  title: string;
  base: string;
  favicon: string | null;
  appleTouchIcon: string | null;
  themeColor: string;
  spaFallback404: boolean;
  defaultMode?: string;
}

function readMeta(): HtmlMeta {
  if (!existsSync(htmlPath)) {
    throw new Error('\n\n  TeamHub has not been generated yet. Run `npm run build` (or `npm run dev`) from the repo root,\n  or `npm run setup` to create your config.\n');
  }
  return JSON.parse(readFileSync(htmlPath, 'utf8'));
}

/** Injects title/icons from the generated config; writes 404.html for GitHub Pages (spec §6.1). */
function teamhubHtml(meta: HtmlMeta): Plugin {
  let outDir = '';
  return {
    name: 'teamhub-html',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    transformIndexHtml(html) {
      const base = meta.base.endsWith('/') ? meta.base : `${meta.base}/`;
      const icons = meta.favicon
        ? `<link rel="icon" type="image/png" href="${base}${meta.favicon}" />${meta.appleTouchIcon ? `\n    <link rel="apple-touch-icon" href="${base}${meta.appleTouchIcon}" />` : ''}`
        : `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='${meta.themeColor}'/><path d='M9 11h14M16 11v12' stroke='white' stroke-width='3.5' stroke-linecap='round'/></svg>`)}" />`;
      return html
        .replaceAll('%TEAMHUB_TITLE%', meta.title.replace(/</g, '&lt;'))
        .replaceAll('%TEAMHUB_THEME_COLOR%', meta.themeColor)
        .replaceAll('%TEAMHUB_DEFAULT_MODE%', meta.defaultMode ?? 'system')
        .replace('%TEAMHUB_ICONS%', icons);
    },
    closeBundle() {
      if (meta.spaFallback404 && existsSync(resolve(outDir, 'index.html'))) copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

export default defineConfig(() => {
  const meta = readMeta();
  return {
    base: meta.base || '/',
    plugins: [react(), tailwindcss(), teamhubHtml(meta)],
    server: { port: 5173, fs: { allow: [repoRoot] } },
    preview: { port: 4173 },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
            if (/node_modules\/@supabase\/(auth-js|postgrest-js)\//.test(id)) return 'supabase';
            if (id.includes('node_modules/three/')) return 'three';
            return undefined;
          },
        },
      },
    },
  };
});
