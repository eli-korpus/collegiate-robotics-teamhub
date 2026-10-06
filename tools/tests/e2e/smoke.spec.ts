import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ME, loadGenerated, mockSupabase, watchErrors } from './mock';

const { schema } = loadGenerated();
const modules = Object.keys(schema.modules);
/** Home's greeting changes by time and date ("Good morning, Sam", "Happy Friday, Sam", "3 days to the qualifier, Sam"). */
const HOME_GREETING = /^[A-Z0-9][A-Za-z0-9 -]+, Sam$/;

test.describe('dashboard smoke', () => {
  test('home renders with greeting and sidebar @phone', async ({ page }) => {
    const errors = watchErrors(page);
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_GREETING })).toBeVisible();
    expect(errors).toEqual([]);
  });

  for (const id of modules) {
    test(`tab "${id}" opens without errors`, async ({ page }) => {
      const errors = watchErrors(page);
      await mockSupabase(page);
      await page.goto(`/${id}`);
      await expect(page.locator('main h1').first()).toBeVisible();
      await page.waitForTimeout(300);
      expect(errors).toEqual([]);
    });
  }

  for (const path of ['/people', '/people?tab=positions', '/admin', '/admin/modules', '/admin/links', '/me']) {
    test(`core page ${path}`, async ({ page }) => {
      const errors = watchErrors(page);
      await mockSupabase(page);
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }

  test('command bar opens with the shortcut and lists tabs', async ({ page }) => {
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_GREETING })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByRole('option', { name: /People/ })).toBeVisible();
  });

  test('members do not see Admin', async ({ page }) => {
    await mockSupabase(page, { admin: false, role: 'member' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: HOME_GREETING })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`home has no serious accessibility violations (${mode})`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem('teamhub-theme', m), mode);
      await mockSupabase(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: HOME_GREETING })).toBeVisible();
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`)).toEqual([]);
    });
  }
});

test('signed-out visitors see the login page @phone', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await expect(page.getByRole('heading', { name: 'Join the team' })).toBeVisible();
});

test.describe('update notice', () => {
  test('admins see a newer TeamHub release in Admin and a dot on the sidebar', async ({ page }) => {
    await mockSupabase(page, { latestRelease: { tag_name: 'v99.0.0', name: 'TeamHub v99.0.0 (security update)' } });
    await page.goto('/admin');
    await expect(page.getByText('Security update available: TeamHub 99.0.0')).toBeVisible();
    await expect(page.getByText('major update')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveAttribute('title', 'TeamHub 99.0.0 is available');
  });
  test('members never contact GitHub', async ({ page }) => {
    let calls = 0;
    await mockSupabase(page, { admin: false, role: 'member', latestRelease: { tag_name: 'v99.0.0', name: 'x' } });
    page.on('request', (r) => {
      if (r.url().startsWith('https://api.github.com/')) calls++;
    });
    await page.goto('/');
    await page.waitForTimeout(1500);
    expect(calls).toBe(0);
  });
});

test.describe('who can join', () => {
  test('the sign-up page says which email to use', async ({ page }) => {
    await page.route('**/rest/v1/rpc/teamhub_join_rules', (route) => route.fulfill({ json: { allowed_email_domains: ['example.edu'] } }));
    await page.goto('/join');
    await expect(page.getByText('Use your @example.edu email')).toBeVisible();
  });

  test('admins can manage the allowed domains and addresses', async ({ page }) => {
    const errors = watchErrors(page);
    await mockSupabase(page, { tables: { teamhub_allowed_emails: [{ email: 'coach@gmail.com', note: 'Mentor' }] } });
    await page.goto('/admin/join');
    await expect(page.getByText('Anyone with your join link can sign up right now.')).toBeVisible();
    await expect(page.getByText('coach@gmail.com')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('required fields', () => {
  test('saving with an empty required field shows a message instead of saving', async ({ page }) => {
    test.skip(!modules.includes('tasks'), 'Uses the Tasks tab');
    const errors = watchErrors(page);
    let inserts = 0;
    await mockSupabase(page);
    await page.route('**/rest/v1/task_items*', (route) => (route.request().method() === 'POST' ? (inserts++, route.fulfill({ status: 201, json: [] })) : route.fallback()));
    await page.goto('/tasks?new=1');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Details')).toBeVisible();
    await expect(dialog.getByText('Optional').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Create task' }).click();
    await expect(dialog.getByText('Please fill this in.')).toBeVisible();
    await expect(dialog.getByLabel('Title')).toBeFocused();
    expect(inserts).toBe(0);
    await dialog.getByLabel('Title').fill('Wire the intake');
    await expect(dialog.getByText('Please fill this in.')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('attendance from the calendar', () => {
  test('Take attendance picks the practice from the calendar instead of making a separate one', async ({ page }) => {
    test.skip(!modules.includes('attendance') || !modules.includes('calendar'), 'Needs Attendance and Calendar');
    const errors = watchErrors(page);
    const now = new Date();
    const at = (h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 30).toISOString();
    await mockSupabase(page, {
      tables: {
        cal_events: [
          { id: 'e1', title: 'Build practice', kind: 'practice', team_id: null, starts_at: at(15), ends_at: at(17), all_day: false, recurrence: null },
          { id: 'e2', title: 'Forms due', kind: 'deadline', team_id: null, starts_at: at(9), ends_at: null, all_day: false, recurrence: null },
        ],
      },
    });
    await page.goto('/attendance');
    await page.getByRole('button', { name: 'Take attendance', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Build practice')).toBeVisible();
    await expect(dialog.getByText('Forms due')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /Not on the calendar\? Add it/ })).toBeVisible();
    await expect(page.getByText('Name', { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('competitions on the calendar', () => {
  test('a competition needs its team, and links to results, Competition Day and attendance', async ({ page }) => {
    test.skip(!['calendar', 'events', 'competition-day', 'attendance'].every((m) => modules.includes(m)), 'Needs Calendar, Events, Competition Day and Attendance');
    const errors = watchErrors(page);
    let inserts = 0;
    const { config } = loadGenerated();
    const teamA = config.teams[0].id;
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    await mockSupabase(page, {
      tables: { cal_events: [{ id: 'c1', title: 'League Qualifier', kind: 'competition', team_id: teamA, event_code: 'USNYQ1', starts_at: `${day}T00:00:00`, ends_at: null, all_day: true, recurrence: null, location: null, notes: null, created_by: null }] },
    });
    await page.route('**/rest/v1/cal_events*', (route) => (route.request().method() === 'POST' ? (inserts++, route.fulfill({ status: 201, json: [] })) : route.fallback()));

    await page.goto(`/calendar?event=c1:${day}`);
    for (const name of ['Results & matches', 'Open Competition Day', 'Take attendance']) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();

    await page.goto('/calendar?new=1&kind=competition');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Competing team', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/If two of your teams go, add an event for each/)).toBeVisible();
    await dialog.getByLabel('Title').fill('Qualifier');
    await dialog.getByRole('button', { name: 'Add to calendar' }).click();
    await expect(dialog.getByText('Please fill this in.')).toBeVisible();
    expect(inserts).toBe(0);
    expect(errors).toEqual([]);
  });
});

test.describe('admins edit people', () => {
  test("Edit on someone's profile changes their name, teams and several subteams in one place", async ({ page }) => {
    const errors = watchErrors(page);
    const { config } = loadGenerated();
    const team = config.teams[0].id;
    const ALEX = '00000000-0000-4000-8000-0000000000a1';
    const now = new Date().toISOString();
    let saved: Record<string, unknown> | null = null;
    await mockSupabase(page, {
      tables: {
        profiles: [
          { id: ME, display_name: 'Sam Rivera', avatar_path: null, is_admin: true, status: 'active', details: {}, home_prefs: null, created_at: now },
          { id: ALEX, display_name: 'Alex Kim', avatar_path: null, is_admin: false, status: 'active', details: { subteam: 'Build' }, home_prefs: null, created_at: now },
        ],
        memberships: [
          { user_id: ME, team_id: team, type: 'mentor', status: 'active', requested_type: null, note: null, created_at: now },
          { user_id: ALEX, team_id: team, type: 'member', status: 'active', requested_type: null, note: null, created_at: now },
        ],
      },
    });
    await page.route('**/rest/v1/profiles*', async (route) => {
      if (route.request().method() === 'PATCH') {
        saved = route.request().postDataJSON();
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    });
    await page.goto(`/people/${ALEX}`);
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Name')).toHaveValue('Alex Kim');
    await expect(dialog.getByText(/Teams and roles|Role/).first()).toBeVisible();
    const subteams = dialog.getByRole('group', { name: 'Subteam' });
    await expect(subteams.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true');
    await subteams.getByRole('button', { name: 'CAD' }).click();
    await dialog.getByText('Subteam', { exact: true }).click(); // clicking the label must not toggle anything
    await expect(subteams.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => saved).not.toBeNull();
    expect((saved as unknown as { details: { subteam: string } }).details.subteam).toBe('Build, CAD');
    expect(errors).toEqual([]);
  });

  test('shirt sizes are team-only: other students never see them', async ({ page }) => {
    const { config } = loadGenerated();
    const team = config.teams[0].id;
    const ALEX = '00000000-0000-4000-8000-0000000000a1';
    const now = new Date().toISOString();
    const people = (meType: string) => ({
      profiles: [
        { id: ME, display_name: 'Sam Rivera', avatar_path: null, is_admin: false, status: 'active', details: {}, home_prefs: null, created_at: now },
        { id: ALEX, display_name: 'Alex Kim', avatar_path: null, is_admin: false, status: 'active', details: { grade: '10' }, home_prefs: null, created_at: now },
      ],
      memberships: [
        { user_id: ME, team_id: team, type: meType, status: 'active', requested_type: null, note: null, created_at: now },
        { user_id: ALEX, team_id: team, type: 'member', status: 'active', requested_type: null, note: null, created_at: now },
      ],
      profiles_leaders: [{ user_id: ALEX, data: { shirt_size: 'M' } }],
    });
    await mockSupabase(page, { tables: people('member') });
    await page.goto(`/people/${ALEX}`);
    await expect(page.getByText('Grade', { exact: true })).toBeVisible();
    await expect(page.getByText('Shirt size', { exact: true })).toHaveCount(0);
    await mockSupabase(page, { tables: people('captain') });
    await page.goto(`/people/${ALEX}`);
    await expect(page.getByText('Shirt size', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Team leaders only').first()).toBeVisible();
  });

  test('admins add a profile field without the setup wizard', async ({ page }) => {
    const errors = watchErrors(page);
    let saved: { extra_profile_fields: { id: string; label: string; type: string; options: string[]; visibility: string }[] } | null = null;
    await mockSupabase(page);
    await page.route('**/rest/v1/teamhub_settings*', async (route) => {
      if (route.request().method() === 'PATCH') {
        saved = route.request().postDataJSON();
        return route.fulfill({ status: 204, body: '' });
      }
      return route.fallback();
    });
    await page.goto('/admin/fields');
    await expect(page.getByText('From setup')).toBeVisible();
    await page.getByRole('button', { name: 'Add a field' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Hoodie size');
    await dialog.getByLabel('Answer', { exact: true }).selectOption('select');
    await dialog.getByPlaceholder('Type one, then Add').fill('S, M, L');
    await expect(dialog.getByRole('button', { name: 'Remove L' })).toBeVisible();
    await dialog.getByLabel('Who can see the answers').selectOption('leaders');
    await dialog.getByRole('button', { name: 'Add field' }).click();
    await expect.poll(() => saved).not.toBeNull();
    expect(saved!.extra_profile_fields).toEqual([{ id: 'x_hoodie_size', label: 'Hoodie size', type: 'select', options: ['S', 'M', 'L'], visibility: 'leaders' }]);
    expect(errors).toEqual([]);
  });
});

test('icon-only buttons show their icons at full size @phone', async ({ page }) => {
  await mockSupabase(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: HOME_GREETING })).toBeVisible();
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => !b.textContent?.trim() && b.querySelector('svg') && b.offsetParent)
      .map((b) => ({ label: b.getAttribute('aria-label'), px: Math.round(b.querySelector('svg')!.getBoundingClientRect().width) })),
  );
  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.filter((s) => s.px < 14)).toEqual([]);
});
