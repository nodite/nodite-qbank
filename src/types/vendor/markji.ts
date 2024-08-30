import cacheManager from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../bank.js'
import {Category} from '../category.js'
import {Params, UploadOptions} from '../common.js'
import {MarkjiSheet} from '../sheet.js'

type MarkjiInfo = {
  chapter: MarkjiSheet
  deck: Category
  folder: Bank
  requestConfig?: CacheRequestConfig
}

type BulkUploadOptions = {
  cacheClient: cacheManager.CacheClient
  markjiInfo: MarkjiInfo
  params: Params
  uploadOptions?: UploadOptions
}

export {BulkUploadOptions, MarkjiInfo}
