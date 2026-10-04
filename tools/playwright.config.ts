import { defineConfig, devices } from '@playwright/test';

/** Smoke tests run against the built dashboard (`npm run build:demo` first) with Supabase stubbed (tools/tests/e2e/mock.ts). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'line' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1360, height: 860 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: 'npm run preview -w @teamhub/dashboard',
    cwd: '..',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
