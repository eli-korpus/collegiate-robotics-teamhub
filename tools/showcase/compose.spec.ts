/**
 * Turns the raw showcase screenshots into the framed images the README uses: a browser window (and a phone) on a soft
 * brand-colored background, in light and dark versions. Run by `npm run screenshots` after capture.spec.ts.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type Page } from '@playwright/test';

const RAW = process.env.SHOWCASE_RAW ?? '.teamhub-ci/showcase';
const OUT = process.env.SCREENSHOTS_DIR ?? 'docs/screenshots';
const img = (name: string) => `data:image/png;base64,${readFileSync(join(RAW, `${name}.png`)).toString('base64')}`;

const THEMES = {
  light: {
    bg: '#f4f7fb',
    glow: 'radial-gradient(1200px 600px at 15% -10%, rgba(37,99,235,.20), transparent 60%), radial-gradient(900px 500px at 100% 110%, rgba(234,88,12,.14), transparent 60%)',
    window: '#ffffff',
    bar: '#f1f4f8',
    border: 'rgba(15,23,42,.10)',
    dot: '#d5dbe3',
    url: '#ffffff',
    urlText: '#64748b',
    shadow: '0 50px 100px -20px rgba(15,23,42,.30), 0 30px 60px -30px rgba(15,23,42,.35)',
  },
  dark: {
    bg: '#0a0f1c',
    glow: 'radial-gradient(1200px 600px at 15% -10%, rgba(67,127,255,.30), transparent 60%), radial-gradient(900px 500px at 100% 110%, rgba(234,88,12,.18), transparent 60%)',
    window: '#18181b',
    bar: '#202024',
    border: 'rgba(255,255,255,.10)',
    dot: '#3a3a40',
    url: '#2a2a2f',
    urlText: '#a1a1aa',
    shadow: '0 50px 100px -20px rgba(0,0,0,.70), 0 30px 60px -30px rgba(0,0,0,.70)',
  },
};
type Theme = keyof typeof THEMES;

function page(theme: Theme, width: number, height: number, body: string) {
  const t = THEMES[theme];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: ${width}px; height: ${height}px; background: ${t.bg}; overflow: hidden; font-family: Inter, -apple-system, 'Segoe UI', sans-serif; }
    .stage { position: relative; width: 100%; height: 100%; background: ${t.glow}; }
    .grid { position: absolute; inset: 0; background-image: linear-gradient(${t.border} 1px, transparent 1px), linear-gradient(90deg, ${t.border} 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at 50% 40%, black, transparent 75%); opacity: .45; }
    .window { position: absolute; background: ${t.window}; border: 1px solid ${t.border}; border-radius: 14px; overflow: hidden; box-shadow: ${t.shadow}; }
    .bar { height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: ${t.bar}; border-bottom: 1px solid ${t.border}; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: ${t.dot}; }
    .url { flex: 0 1 360px; margin: 0 auto; height: 24px; border-radius: 7px; background: ${t.url}; border: 1px solid ${t.border}; color: ${t.urlText}; font-size: 12.5px; display: grid; place-items: center; transform: translateX(-30px); }
    .window img { display: block; width: 100%; }
    .phone { position: absolute; border-radius: 52px; padding: 11px; background: #0b0b0f; box-shadow: ${t.shadow}, 0 0 0 1.5px rgba(255,255,255,.08) inset; }
    .phone img { display: block; width: 100%; border-radius: 42px; }
  </style></head><body><div class="stage"><div class="grid"></div>${body}</div></body></html>`;
}

// `crop` hides the app's 248 px sidebar (of 1440) so a gallery tile shows the tab itself, larger.
const windowHtml = (src: string, style: string, crop = false) =>
  `<div class="window" style="${style}"><div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="url">riverside-robotics.pages.dev</span></div><div style="overflow: hidden"><img src="${src}" style="${crop ? 'width: calc(100% * 1440 / 1192); margin-left: calc(-100% * 248 / 1192); max-width: none;' : ''}"></div></div>`;

async function render(p: Page, html: string, width: number, height: number, name: string) {
  await p.setViewportSize({ width, height });
  await p.setContent(html);
  await p.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await p.screenshot({ path: join(OUT, `${name}.png`) });
}

test.use({ deviceScaleFactor: 1.5 });

for (const theme of ['light', 'dark'] as const) {
  test(`hero ${theme}`, async ({ page: p }) => {
    const W = 1600;
    const H = 1010;
    const desktop = img(theme === 'light' ? 'home' : 'home-dark');
    const phone = img(theme === 'light' ? 'phone-home' : 'phone-home-dark');
    const body = `${windowHtml(desktop, `left: 64px; top: 64px; width: 1240px;`)}<div class="phone" style="right: 64px; top: 210px; width: 330px;"><img src="${phone}"></div>`;
    await render(p, page(theme, W, H, body), W, H, `hero-${theme}`);
  });
}

const TILES: [raw: string, theme: Theme][] = [
  ['competition-day', 'light'],
  ['tasks-dark', 'dark'],
  ['calendar', 'light'],
  ['notebook', 'light'],
  ['driver-practice-dark', 'dark'],
  ['code-hub-dark', 'dark'],
];
for (const [raw, theme] of TILES) {
  test(`tile ${raw}`, async ({ page: p }) => {
    const W = 1200;
    const H = 800;
    // The window is taller than the tile, so it fades out at the bottom edge like a peek into the app.
    const body = `${windowHtml(img(raw), `left: 56px; top: 56px; width: 1088px;`, true)}`;
    await render(p, page(theme, W, H, body), W, H, raw.replace(/-dark$/, ''));
  });
}

// The TeamHub mark (same as the link-preview image): for the README header, on a transparent background.
test('logo', async ({ page: p }) => {
  await p.setViewportSize({ width: 256, height: 256 });
  await p.setContent(`<!doctype html><html><head><style>
    * { margin: 0; } html, body { background: transparent; }
    .mark { position: relative; width: 256px; height: 256px; border-radius: 60px; background: #2563eb; }
    .bar { position: absolute; background: #fff; border-radius: 12px; }
  </style></head><body><div class="mark"><div class="bar" style="left: 76px; top: 82px; width: 104px; height: 24px;"></div><div class="bar" style="left: 116px; top: 82px; width: 24px; height: 96px;"></div></div></body></html>`);
  await p.locator('.mark').screenshot({ path: join(process.env.ASSETS_DIR ?? 'docs/assets', 'logo.png'), omitBackground: true });
});
