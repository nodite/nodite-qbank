import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from './main.js'

export default class Demo extends Vendor {
  public static VENDOR_NAME: string = 'demo'

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async getBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder((args) => args[0]), hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async getCategories(_: number | string): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const username = this.getUsername()
    return {
      headers: {password},
      params: {username},
    }
  }
}
