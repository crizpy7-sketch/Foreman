import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'index.html', 'coverage'] },
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
