// Configuration ESLint (flat config). Outil de qualité du code, dev uniquement :
// aucune dépendance n'est embarquée dans le dossier `public/` déployé.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  // Code applicatif : modules ES exécutés dans le navigateur.
  {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Tests + outillage : exécutés sous Node / Vitest.
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  // Tests e2e Playwright : code Node + code exécuté dans la page (page.evaluate),
  // d'où les globals navigateur en plus.
  {
    files: ['tests/e2e/**/*.{js,mjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
  prettier,
];
