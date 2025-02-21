import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import md5 from 'md5'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {OutputClass} from '../../output/common.js'
import Skip from '../../output/skip.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class Demo extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'Demo'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
    }
  }

  public async fetchQuestions(
    _qbank: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(qbank: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: qbank.category.count, id: md5('0'), name: '默认'}]
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_qbank: {bank: Bank}): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    return {
      headers: {password},
      params: {username: this.getUsername()},
    }
  }
}
