import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules', 'coverage', 'public', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['src/ui/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    // The engine must stay pure TypeScript with zero UI dependencies.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', 'dexie', '**/ui/**', '**/db/**'] },
      ],
    },
  },
);
