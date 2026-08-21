import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['node_modules', 'playwright-report', 'test-results', 'blob-report', '.auth'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tests/**/*.ts', 'global.setup.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Page objects own the assertions they need; expect() inside them is intentional.
      'playwright/no-standalone-expect': 'off',
      // Every spec must state at least one assertion of its own - page-object expect*()
      // helpers guard navigation, they are not a substitute for the test's own claim.
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expect'] }],
      // Title convention - see specs/test-title-format.design.md. Only the mechanical half is
      // enforced: no modal verbs, no filler adverbs, tags in the `tag` option rather than the
      // title. Deliberately no `mustMatch` on test titles - a regex cannot tell an informative
      // title from a merely compliant one, and rewarding the pattern over the description would
      // make the report worse.
      'playwright/valid-title': [
        'error',
        {
          disallowedWords: ['should', 'must', 'correctly', 'properly'],
          mustNotMatch: {
            test: ['@', 'tags belong in the tag option, not in the title'],
          },
          mustMatch: {
            describe: ['^[A-Z]', 'describe titles start with a capitalised scope'],
          },
        },
      ],
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      'no-console': 'warn',
    },
  },
  prettier,
);
