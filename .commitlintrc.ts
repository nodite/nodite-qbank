import type {UserConfig} from '@commitlint/types'

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 100],
    'scope-empty': [1, 'never'],
    'scope-enum': [2, 'always', []],
    'type-enum': [2, 'always', ['chore', 'docs', 'feat', 'fix']],
  },
}

export default Configuration
