import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {FlatCompat} from '@eslint/eslintrc'
import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
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
    plugins: {
      'simple-import-sort': simpleImportSort,
    },

    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },

      parser: tsParser,
      ecmaVersion: 2017,
      sourceType: 'module',
    },

    rules: {
      'max-len': [
        'error',
        {
          code: 120,
        },
      ],

      'no-warning-comments': 'off',
      semi: ['error', 'never'],
      'valid-jsdoc': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'new-cap': 'off',
      camelcase: 'off',
      'no-await-in-loop': 'off',
      'import/default': 'off',
      'import/no-named-as-default-member': 'off',
      'unicorn/no-array-for-each': 'off',
      'unicorn/error-message': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      'no-constant-condition': 'off',
      'n/hashbang': 'off',
      'n/no-unpublished-bin': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
        },
      ],
      'unicorn/prefer-global-this': 'off',
      complexity: 'off',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },
]
