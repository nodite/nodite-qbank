import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {FlatCompat} from '@eslint/eslintrc'
import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import perfectionist from 'eslint-plugin-perfectionist'
import globals from 'globals'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  allConfig: js.configs.all,
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
})

/** @type { import("eslint").Linter.Config[] } */
export default [
  js.configs.recommended,
  {
    ignores: ['dist', 'node_modules', 'src/assets/*.js', 'tmp'],
  },
  {
    files: ['*.ts', '*.tsx'],
  },
  ...compat.extends(
    'oclif',
    // "oclif-typescript",
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'plugin:prettier/recommended',
  ),
  {
    languageOptions: {
      ecmaVersion: 2017,

      globals: {
        ...globals.jest,
        ...globals.node,
      },
      parser: tsParser,
      sourceType: 'module',
    },

    plugins: {perfectionist},

    rules: {
      '@typescript-eslint/adjacent-overload-signatures': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      camelcase: 'off',
      complexity: 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'import/order': 'off',
      'max-len': [
        'error',
        {
          code: 120,
        },
      ],
      'n/hashbang': 'off',
      'n/no-unpublished-bin': 'off',
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          allowExperimental: true,
        },
      ],
      'new-cap': 'off',
      'no-await-in-loop': 'off',
      'no-constant-condition': 'off',
      'no-warning-comments': 'off',
      'perfectionist/sort-classes': ['error', {type: 'natural'}],
      'perfectionist/sort-exports': ['error', {type: 'natural'}],
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            'side-effect',
            ['builtin', 'builtin-type'],
            'type',
            ['external', 'external-type'],
            ['internal', 'internal-type'],
            ['parent-type', 'sibling-type', 'index-type'],
            ['parent', 'sibling', 'index'],
            'object',
            'unknown',
          ],
          newlinesBetween: 'always',
          partitionByNewLine: false,
          type: 'natural',
        },
      ],
      'perfectionist/sort-interfaces': ['error', {type: 'natural'}],
      'perfectionist/sort-object-types': ['error', {type: 'natural'}],
      'perfectionist/sort-objects': ['error', {type: 'natural'}],
      semi: ['error', 'never'],
      'sort-imports': 'off',
      'sort-keys': 'off',
      'unicorn/error-message': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/prefer-global-this': 'off',
      'valid-jsdoc': 'off',
    },

    settings: {
      perfectionist: {
        partitionByComment: true,
        type: 'line-length',
      },
    },
  },
]
