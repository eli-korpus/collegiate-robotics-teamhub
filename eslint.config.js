// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** Modules may import only from @teamhub/sdk, @teamhub/ui, npm packages and their own folder (spec §4.2). */
const moduleBoundary = {
  patterns: [
    { group: ['**/tabs/*', '../../*/**'], message: 'Tabs must not import from other tabs (spec P2). Use registries or an integration unit.' },
    { group: ['**/integrations/*'], message: 'Tabs must not import integrations.' },
    { group: ['**/dashboard/*', '**/setup-wizard/*'], message: 'Tabs must not import from the dashboard or the wizard.' },
  ],
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'dashboard/src/generated/**', 'database/functions/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  { files: ['tools/scripts/**', '**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } } },
  { files: ['tabs/**/*.{ts,tsx}'], ignores: ['**/*.test.ts', 'tabs/integrations/**'], rules: { 'no-restricted-imports': ['error', moduleBoundary] } },
  {
    // Home cards load with Home: importing the tab's screens would download the whole tab just to show a card.
    // A warning, not an error, so a team's own older cards never block an update.
    files: ['tabs/*/widgets/**/*.{ts,tsx}', 'tabs/*/ui/*Widget.tsx'],
    ignores: ['tabs/integrations/**'],
    rules: {
      // The TypeScript twin of the rule, so the tab-boundary rule above stays an error for these files.
      '@typescript-eslint/no-restricted-imports': [
        'warn',
        { patterns: [{ group: ['**/Routes', '**/ui/shared'], message: 'Home cards import data hooks from ui/data.ts, not the tab screens (they would load the whole tab on Home).' }] },
      ],
    },
  },
  {
    files: ['tabs/integrations/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/tabs/*', '../../*/**', '**/dashboard/*', '**/setup-wizard/*'], message: 'Integrations talk to tabs only through tables and registries.' }] }],
    },
  },
);
