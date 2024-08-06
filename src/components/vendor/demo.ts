import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from './main.js'

export default class Demo extends Vendor {
  public static VENDOR_NAME: string = 'demo'

  public async getBankList(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  public async login(password: string): Promise<CacheRequestConfig> {
    const username = this.getUsername()
    return {
      headers: {password},
      params: {username},
    }
  }
}
