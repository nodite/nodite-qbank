import cacheManager from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {MarkjiFolder} from '../bank.js'
import {Category} from '../category.js'
import {Params, UploadOptions} from '../common.js'
import {MarkjiChapter} from '../sheet.js'

type MarkjiInfo = {
  chapter: MarkjiChapter
  deck: Category
  folder: MarkjiFolder
  requestConfig?: CacheRequestConfig
}

type BulkUploadOptions = {
  cacheClient: cacheManager.CacheClient
  markjiInfo: MarkjiInfo
  params: Params
  uploadOptions?: UploadOptions
}

export {BulkUploadOptions, MarkjiInfo}
