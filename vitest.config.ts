import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'modules/**/*.test.ts', 'integrations/**/*.test.ts', 'apps/wizard/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
