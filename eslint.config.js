// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/** Modules may import only from @teamhub/sdk, @teamhub/ui, npm packages and their own folder (spec §4.2). */
const moduleBoundary = {
  patterns: [
    { group: ['**/modules/*', '../../*/**', '@modules/*'], message: 'Modules must not import from other modules (spec P2). Use registries or an integration unit.' },
    { group: ['**/integrations/*'], message: 'Modules must not import integrations.' },
    { group: ['**/apps/*'], message: 'Modules must not import from apps.' },
  ],
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'apps/dashboard/src/generated/**', 'supabase/functions/**', 'test-results/**', 'playwright-report/**'] },
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
  { files: ['scripts/**', '**/*.mjs'], languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } } },
  { files: ['modules/**/*.{ts,tsx}'], rules: { 'no-restricted-imports': ['error', moduleBoundary] } },
  {
    files: ['integrations/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['**/modules/*', '**/apps/*'], message: 'Integrations talk to modules only through tables and registries.' }] }],
    },
  },
);
