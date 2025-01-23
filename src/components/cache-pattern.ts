/* eslint-disable max-len */

export enum HashKeyScope {
  BANKS = 'banks',
  CATEGORIES = 'categories',
  CUSTOM = 'custom',
  LOGIN = 'login',
  ORIGIN_QUESTIONS = 'origin-questions',
  QUESTIONS = 'questions',
  SHEETS = 'sheets',
}

export const CACHE_KEY_PREFIX = ''

//
// banks.
//
export const CACHE_KEY_BANKS = `{{vendorKey}}:${HashKeyScope.BANKS}:`
// export const CACHE_KEY_BANKS = `${HashKeyScope.BANKS}:`

//
// categories.
//
export const CACHE_KEY_CATEGORIES = `{{vendorKey}}:${HashKeyScope.CATEGORIES}:{{bankId}}`
// export const CACHE_KEY_CATEGORIES = `${HashKeyScope.CATEGORIES}:{{bankId}}`

//
// login.
//
export const CACHE_KEY_LOGIN = `{{vendorKey}}:${HashKeyScope.LOGIN}:{{username}}`
// export const CACHE_KEY_LOGIN = `${HashKeyScope.LOGIN}:{{username}}`

//
// sheets.
//
export const CACHE_KEY_SHEETS = `{{vendorKey}}:${HashKeyScope.SHEETS}:{{bankId}}:{{categoryId}}`
// export const CACHE_KEY_SHEETS = `${HashKeyScope.SHEETS}:{{bankId}}:{{categoryId}}`

//
// origin questions.
//
export const CACHE_KEY_ORIGIN_QUESTION_PREFIX = `{{vendorKey}}:${HashKeyScope.ORIGIN_QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}`
// export const CACHE_KEY_ORIGIN_QUESTION_PREFIX = `${HashKeyScope.ORIGIN_QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}`

export const CACHE_KEY_ORIGIN_QUESTION_PROCESSING = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:processing:{{processScope}}:{{processId}}`

export const CACHE_KEY_ORIGIN_QUESTION_ITEM = `${CACHE_KEY_ORIGIN_QUESTION_PREFIX}:item:{{questionId}}`

//
// questions.
//
export const CACHE_KEY_QUESTION_PREFIX = `{{vendorKey}}:${HashKeyScope.QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}:{{outputKey}}`
// export const CACHE_KEY_QUESTION_PREFIX = `${HashKeyScope.QUESTIONS}:{{bankId}}:{{categoryId}}:{{sheetId}}:{{outputKey}}`

export const CACHE_KEY_QUESTION_ITEM = `${CACHE_KEY_QUESTION_PREFIX}:item:{{questionId}}`

//
// custom.
//
export const CACHE_KEY_CUSTOM_PREFIX = `{{vendorKey}}:${HashKeyScope.CUSTOM}:{{key}}`
// export const CACHE_KEY_CUSTOM_PREFIX = `${HashKeyScope.CUSTOM}:{{key}}`

export const CACHE_KEY_CUSTOM_ITEM = `${CACHE_KEY_CUSTOM_PREFIX}:item:{{itemId}}`
