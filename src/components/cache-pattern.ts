/* eslint-disable max-len */

export enum HashKeyScope {
  BANKS = 'banks',
  CATEGORIES = 'categories',
  LOGIN = 'login',
  ORIGIN_QUESTIONS = 'origin-questions',
  QUESTIONS = 'questions',
  SHEETS = 'sheets',
}

export const CACHE_KEY_PREFIX = '{{vendorKey}}:{{scope}}'

//
// origin questions.
//
export const CACHE_KEY_ORIGIN_QUESTION_PREFIX = `{{vendorKey}}:${HashKeyScope.ORIGIN_QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}`

export const CACHE_KEY_ORIGIN_QUESTION_PROCESSING = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:processing:{{processScope}}`

export const CACHE_KEY_ORIGIN_QUESTION_ITEM = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:item`

//
// questions.
//
export const CACHE_KEY_QUESTION_PREFIX = `{{vendorKey}}:${HashKeyScope.QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}:{{outputKey}}`

export const CACHE_KEY_QUESTION_ITEM = `${CACHE_KEY_QUESTION_PREFIX}:item`

export const CACHE_KEY_QUESTION_UPLOAD = `${CACHE_KEY_QUESTION_PREFIX}:upload`
