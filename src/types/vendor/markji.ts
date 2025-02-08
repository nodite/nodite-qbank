import cacheManager from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {MarkjiFolder} from '../bank.js'
import {Category} from '../category.js'
import {QBankParams, UploadOptions} from '../common.js'
import {MarkjiChapter} from '../sheet.js'

type MarkjiInfo = {
  chapter: MarkjiChapter
  config?: CacheRequestConfig
  deck: Category
  folder: MarkjiFolder
}

type BulkUploadOptions = {
  cacheClient: cacheManager.CacheClient
  markji: MarkjiInfo
  qbank: QBankParams
  uploadOptions?: UploadOptions
}

export {BulkUploadOptions, MarkjiInfo}
