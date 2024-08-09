/* eslint-disable max-len */

export enum HashKeyScope {
  BANKS = 'banks',
  CATEGORIES = 'categories',
  LOGIN = 'login',
  ORIGIN_QUESTIONS = 'origin-questions',
  QUESTIONS = 'questions',
}

export const CACHE_KEY_PREFIX = '{{vendorName}}:{{username}}:{{scope}}'

//
// origin questions.
//
export const CACHE_KEY_ORIGIN_QUESTION_PREFIX = `{{vendorName}}:{{username}}:${HashKeyScope.ORIGIN_QUESTIONS}:{{bankId}}:{{categoryId}}`

export const CACHE_KEY_ORIGIN_QUESTION_PROCESSING = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:processing:{{processScope}}`

export const CACHE_KEY_ORIGIN_QUESTION_ITEM = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:item`

//
// questions.
//
export const CACHE_KEY_QUESTION_PREFIX = `{{vendorName}}:{{username}}:${HashKeyScope.QUESTIONS}:{{bankId}}:{{categoryId}}`

export const CACHE_KEY_QUESTION_ITEM = `${CACHE_KEY_QUESTION_PREFIX}:item`
