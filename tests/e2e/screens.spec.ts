import { test } from '@playwright/test';
import { mockSupabase } from './mock';

/** Visual snapshots for docs/README (run with SCREENSHOTS=dir). Skipped in normal runs. */
const dir = process.env.SCREENSHOTS;
test.skip(!dir, 'set SCREENSHOTS=<dir> to capture');

const pages = (process.env.SCREEN_PAGES ?? '/,/calendar,/attendance,/people,/admin').split(',');
for (const mode of ['light', 'dark']) {
  for (const p of pages) {
    test(`${mode} ${p}`, async ({ page }, info) => {
      await page.addInitScript((m) => localStorage.setItem('teamhub-theme', m), mode);
      await mockSupabase(page, JSON.parse(process.env.SCREEN_DATA ?? '{}'));
      await page.goto(p);
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${dir}/${info.project.name}-${mode}-${p.replace(/[/?=&]+/g, '_') || 'home'}.png` });
    });
  }
}
