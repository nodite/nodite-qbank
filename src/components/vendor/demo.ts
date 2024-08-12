import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class Demo extends Vendor {
  public static VENDOR_NAME: string = 'demo'

  public async convertQuestions(_bank: Bank, _category: Category): Promise<void> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_bank: Bank): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  public async fetchQuestions(_bank: Bank, _category: Category, _sheet: Sheet, _options?: FetchOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public fetchSheet(_bank: Bank, _category: Category, _options?: FetchOptions): Promise<Sheet[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const username = this.getUsername()
    return {
      headers: {password},
      params: {username},
    }
  }
}
