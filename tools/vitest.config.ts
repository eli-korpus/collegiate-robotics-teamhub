import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Paths below are relative to the repository root.
  root: resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  test: {
    include: ['packages/**/*.test.ts', 'tabs/**/*.test.ts', 'setup-wizard/**/*.test.ts', 'tools/tests/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
  },
});
