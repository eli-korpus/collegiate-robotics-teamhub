/**
 * README screenshots of a made-up program ("Riverside Robotics") that looks full and alive.
 * Run with `npm run screenshots`: raw shots go to .teamhub-ci/showcase/, then compose.spec.ts frames them into docs/screenshots/. Supabase and FTCScout are stubbed with tools/showcase/data.ts.
 */
import { test, type Page } from '@playwright/test';
import { mockSupabase, waitForHome } from '../tests/e2e/mock';
import { ftcScout, tables } from './data';

const OUT = process.env.SHOWCASE_RAW ?? '.teamhub-ci/showcase';

/** Home's layout for the screenshot: the cards a captain looks at most, in a pleasing order. */
const HOME = {
  order: [
    'announcements:unread', 'attendance:take-today', 'tasks:my-tasks', 'polls:open', 'signups:mine', 'batteries:needs-charge',
    'calendar:up-next', 'events:next-event', 'notebook:recent', 'outreach:season', 'core:activity', 'core:links', 'inventory:low', 'skills:next', 'core:team',
  ],
  hidden: [
    'core:profile-setup', 'core:approvals', 'manufacture:queue', 'attendance:my-attendance', 'paperwork:owed', 'merch:open', 'manufacture:my-parts', 'social:queue', 'outreach:approve', 'outreach:outreach',
    'purchases:to-order', 'sponsors:followups', 'skills:skills', 'tasks:tasks', 'media:latest', 'competition-day:next-match',
  ],
};

async function open(page: Page, path: string, opts: { mode?: 'light' | 'dark'; live?: boolean; storage?: Record<string, unknown> } = {}) {
  await page.addInitScript(
    ([m, s]) => {
      localStorage.setItem('teamhub-theme', m);
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v));
    },
    [opts.mode ?? 'light', opts.storage ?? {}] as const,
  );
  await mockSupabase(page, { tables: tables({ live: opts.live, homePrefs: HOME }), realFtcScout: true });
  await page.route('https://api.ftcscout.org/**', async (r) => r.fulfill({ json: { data: ftcScout(r.request().postDataJSON(), !!opts.live) } }));
  // Code Hub's repository card: made-up commits and pull requests.
  await page.route('https://api.github.com/repos/**', (r) => {
    const url = r.request().url();
    const titans = url.includes('torque-titans');
    if (url.includes('/pulls')) return r.fulfill({ json: titans ? [] : [{ number: 42, title: 'Field-centric drive with IMU reset', html_url: 'https://github.com', user: { login: 'jreyes' }, created_at: new Date(Date.now() - 3 * 3600_000).toISOString() }] });
    const msgs = titans ? ['Arm: 60:1 gearing constants', 'Field-centric drive for TeleOp', 'Servo presets for the claw'] : ['Tune heading PID for 3-piece auto', 'Add slow mode on gamepad 1 A', 'Lift: limit switch at bottom', 'Intake: reverse on jam', 'Odometry pod offsets from CAD', 'Auto: park in observation zone'];
    return r.fulfill({ json: msgs.map((m, i) => ({ sha: `abc${i}`, html_url: 'https://github.com', commit: { message: m, author: { name: (titans ? ['Marcus Johnson', 'Kai Patel'] : ['Jordan Reyes', 'Liam Chen', 'Maya Robinson'])[i % (titans ? 2 : 3)], date: new Date(Date.now() - (i * 7 + 1) * 3600_000).toISOString() } } })) });
  });
  // Favicons for the team tools.
  await page.route('https://www.google.com/s2/**', (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

async function shoot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

test.use({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });

test('home (hero)', async ({ page }) => {
  await open(page, '/');
  await waitForHome(page);
  await shoot(page, 'home');
});

test('home dark', async ({ page }) => {
  await open(page, '/', { mode: 'dark' });
  await waitForHome(page);
  await shoot(page, 'home-dark');
});

test('calendar', async ({ page }) => {
  await open(page, '/calendar');
  await shoot(page, 'calendar');
});

test('tasks', async ({ page }) => {
  await open(page, '/tasks', { mode: 'dark', storage: { 'teamhub-tasks-view': 'board' } });
  await shoot(page, 'tasks-dark');
});

test('competition day', async ({ page }) => {
  await open(page, '/competition-day', { live: true });
  await shoot(page, 'competition-day');
});

test('notebook', async ({ page }) => {
  await open(page, '/notebook?item=aaaaaaaa-0000-4000-8000-000000000127');
  await shoot(page, 'notebook');
});

test('driver practice', async ({ page }) => {
  await open(page, '/driver-practice', { mode: 'dark' });
  await shoot(page, 'driver-practice-dark');
});

test('code hub', async ({ page }) => {
  await open(page, '/code-hub', { mode: 'dark' });
  await shoot(page, 'code-hub-dark');
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  test('home on a phone', async ({ page }) => {
    await open(page, '/');
    await waitForHome(page);
    await shoot(page, 'phone-home');
  });
  test('home on a phone (dark)', async ({ page }) => {
    await open(page, '/', { mode: 'dark' });
    await waitForHome(page);
    await shoot(page, 'phone-home-dark');
  });
});
