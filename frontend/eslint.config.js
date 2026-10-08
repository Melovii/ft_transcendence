import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  /*
   * Layer boundaries:
   *   shared/ never imports features/, app/ or layouts/;
   *   a feature never imports another feature;
   *   UI components never call REST/WS directly — always through a feature hook.
   * The first two are enforced here; the third is a review rule.
   */
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*', '@app/*', '@layouts/*'],
              message:
                'shared/ must not depend on app, layouts or features. Invert the dependency instead.',
            },
          ],
        },
      ],
    },
  },
  ...['auth', 'lobby', 'room', 'game', 'profile', 'friends', 'chat', 'stats'].map((feature) => ({
    files: [`src/features/${feature}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@features/*', `!@features/${feature}`, `!@features/${feature}/**`],
              message:
                'Features must not import each other. Go through shared/ or an app-level mount point.',
            },
          ],
        },
      ],
    },
  })),
);
