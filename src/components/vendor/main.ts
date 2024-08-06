import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {CacheKeyBuilder, Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'

enum HashKeyScope {
  BANKS = 'banks',
  LOGIN = 'login',
}

const cacheKeyBuilder = (): CacheKeyBuilder<unknown[], unknown> => {
  return (args, context): string => {
    if (args.length > 0 && args[0] instanceof Vendor) {
      return args[0].getUsername()
    }

    if (context instanceof Vendor) {
      return context.getUsername()
    }

    throw new Error('Invalid cache key')
  }
}

const hashKeyBuilder = (scope: HashKeyScope): CacheKeyBuilder<unknown[], unknown> => {
  return (args, context): string => {
    if (args.length > 0 && args[0] instanceof Vendor) {
      return `${(args[0].constructor as typeof Vendor).VENDOR_NAME}:${scope}`
    }

    if (context instanceof Vendor) {
      return `${(context.constructor as typeof Vendor).VENDOR_NAME}:${scope}`
    }

    throw new Error('Invalid hash key')
  }
}

abstract class Vendor {
  public static VENDOR_NAME: string

  private username: string

  /**
   * Constructor
   * @param username
   */
  constructor(username: string) {
    this.username = username
  }

  /**
   * Get request config
   */
  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  public async getRequestConfig(): Promise<CacheRequestConfig> {
    throw new Error(
      `Please run 'vendor login ${(this.constructor as typeof Vendor).VENDOR_NAME} -u ${
        this.username
      }' command to login first.`,
    )
  }

  /**
   * Get username
   * @returns
   */
  public getUsername(): string {
    return this.username
  }

  /**
   * Get course list
   */
  public abstract getBankList(): Promise<Bank[]>

  /**
   * Login to vendor
   * @param password
   */
  public abstract login(password: string): Promise<CacheRequestConfig>
}

// Vendor class type
type VendorClass = new (username: string) => Vendor

// Export
export {HashKeyScope, Vendor, VendorClass, cacheKeyBuilder, hashKeyBuilder}
