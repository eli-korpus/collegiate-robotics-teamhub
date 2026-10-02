import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { loadGenerated, mockSupabase, watchErrors } from './mock';

const { schema } = loadGenerated();
const modules = Object.keys(schema.modules);

test.describe('dashboard smoke', () => {
  test('home renders with greeting and sidebar @phone', async ({ page }) => {
    const errors = watchErrors(page);
    await mockSupabase(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Good (morning|afternoon|evening), Sam/ })).toBeVisible();
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
    await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('combobox')).toBeVisible();
    await expect(page.getByRole('option', { name: /People/ })).toBeVisible();
  });

  test('members do not see Admin', async ({ page }) => {
    await mockSupabase(page, { admin: false, role: 'member' });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
  });

  for (const mode of ['light', 'dark'] as const) {
    test(`home has no serious accessibility violations (${mode})`, async ({ page }) => {
      await page.addInitScript((m) => localStorage.setItem('teamhub-theme', m), mode);
      await mockSupabase(page);
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Good/ })).toBeVisible();
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
