import type {UserConfig} from '@commitlint/types'

const Configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [1, 'always', 100],
    'type-enum': [2, 'always', ['chore', 'docs', 'feat', 'fix']],
    'scope-enum': [2, 'always', []],
    'scope-empty': [1, 'never'],
  },
}

export default Configuration
