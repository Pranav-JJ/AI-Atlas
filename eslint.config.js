import js from '@eslint/js'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/content/generated', 'node_modules'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /*
       * Filter and onboarding options wrap an input plus a two-line description
       * in a <label>. That is implicitly associated and correctly named by its
       * text content; the rule simply stops looking below its default depth.
       */
      'jsx-a11y/label-has-associated-control': ['error', { depth: 4 }],

      /*
       * Security guardrails from the plan (§F). These are the two rules that stop
       * the two XSS/tabnabbing footguns this product is actually exposed to.
       */
      'react/no-danger': 'off', // superseded by the explicit ban below
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
          message:
            'dangerouslySetInnerHTML is banned. Content is JSON strings only; React escapes them. If Markdown is ever introduced (Phase 11), it must go through an allowlist sanitizer and this rule must be relaxed deliberately, per-file, with a test.',
        },
        {
          selector:
            'JSXOpeningElement[name.name="a"]:has(JSXAttribute[name.name="target"][value.value="_blank"]):not(:has(JSXAttribute[name.name="rel"]))',
          message:
            'target="_blank" requires rel="noopener noreferrer" (tabnabbing). Prefer the <ExternalLink> component, which sets this for you.',
        },
      ],
    },
  },

  // Config and build scripts are Node-only and are not part of the shipped bundle.
  {
    files: ['*.config.{js,ts}', 'scripts/**/*.{js,mjs,ts}'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
)
