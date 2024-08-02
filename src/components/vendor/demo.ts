import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'

import {Vendor} from './main.js'

const VENDOR_NAME = 'demo'

export default class Demo extends Vendor {
  public static name: string = VENDOR_NAME

  @Cacheable({cacheKey: (args) => args[0], hashKey: `${VENDOR_NAME}:login`})
  public async login(username: string, password: string): Promise<CacheRequestConfig> {
    return {
      headers: {password},
      params: {username},
    }
  }
}
