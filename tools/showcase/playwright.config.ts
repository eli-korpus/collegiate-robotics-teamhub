import { defineConfig, devices } from '@playwright/test';

/** README screenshots (`npm run screenshots`): the dashboard built from showcase.config.json with data stubbed, then framed. */
export default defineConfig({
  testDir: '.',
  timeout: 60_000,
  workers: 4,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' },
  projects: [
    { name: 'capture', testMatch: 'capture.spec.ts' },
    { name: 'compose', testMatch: 'compose.spec.ts', dependencies: ['capture'] },
  ],
  webServer: {
    command: 'npm run preview -w @teamhub/dashboard',
    cwd: '../..',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
