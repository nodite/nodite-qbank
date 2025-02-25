import cacheManager from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../bank.js'
import {Category} from '../category.js'
import {QBankParams, UploadOptions} from '../common.js'
import {Sheet} from '../sheet.js'

type Folder = Bank & {
  meta: {
    [key: string]: any
    items: {object_class: string; object_id: string}[]
    updated_time: string
  }
}

type Deck = Category

type Chapter = Sheet & {
  meta: {
    [key: string]: any
    cardIds: string[]
    revision: number
    setRevision: number
  }
}

type MarkjiParams = {
  chapter: Chapter
  config: CacheRequestConfig
  deck: Deck
  folder: Folder
}

type BulkUploadOptions = {
  cacheClient: cacheManager.CacheClient
  markji: MarkjiParams
  qbank: QBankParams
  uploadOptions?: UploadOptions
}

export {BulkUploadOptions, Chapter, Deck, Folder, MarkjiParams}
