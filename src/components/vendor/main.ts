import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {CacheKeyBuilder, Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'

enum HashKeyScope {
  BANKS = 'banks',
  CATEGORIES = 'categories',
  LOGIN = 'login',
}

const cacheKeyBuilder = (builder?: CacheKeyBuilder): CacheKeyBuilder => {
  return (args, context): string => {
    const keys = []

    if (context instanceof Vendor) {
      keys.push(context.getUsername())
    } else if (args.length > 0 && args[0] instanceof Vendor) {
      keys.push(args[0].getUsername())
    }

    if (builder) {
      keys.push(builder(args, context))
    }

    if (keys.length === 0) {
      throw new Error('Invalid cache key')
    }

    return keys.join(':')
  }
}

const hashKeyBuilder = (scope: HashKeyScope, builder?: CacheKeyBuilder): CacheKeyBuilder => {
  return (args, context): string => {
    const keys = []

    if (context instanceof Vendor) {
      keys.push((context.constructor as typeof Vendor).VENDOR_NAME)
    } else if (args.length > 0 && args[0] instanceof Vendor) {
      keys.push((args[0].constructor as typeof Vendor).VENDOR_NAME)
    }

    keys.push(scope)

    if (builder) {
      keys.push(builder(args, context))
    }

    if (keys.length === 0) {
      throw new Error('Invalid hash key')
    }

    return keys.join(':')
  }
}

abstract class Vendor {
  public static VENDOR_NAME: string

  /**
   * Get username
   * @returns
   */
  public getUsername = () => this.username

  private username: string

  /**
   * Constructor
   * @param username
   */
  constructor(username: string) {
    this.username = username
  }

  public async banks(): Promise<Bank[]>

  public async banks(fromCache: true): Promise<Bank[]>

  public async banks(fromCache?: true): Promise<Bank[]> {
    return fromCache ? this._banks() : this.getBanks()
  }

  public async categories(keyOrId: number | string): Promise<Category[]>

  public async categories(keyOrId: number | string, fromCache: true): Promise<Category[]>

  public async categories(keyOrId: number | string, fromCache?: true): Promise<Category[]> {
    return fromCache ? this._categories(keyOrId) : this.getCategories(keyOrId)
  }

  public async login(): Promise<CacheRequestConfig>

  public async login(password: string): Promise<CacheRequestConfig>

  public async login(password?: string): Promise<CacheRequestConfig> {
    return password === undefined ? this._login() : this.toLogin(password)
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async _banks(): Promise<Bank[]> {
    throw new Error(
      `Please run 'bank list -v ${
        (this.constructor as typeof Vendor).VENDOR_NAME
      } -u ${this.getUsername()}' command to get banks first.`,
    )
  }

  @Cacheable({cacheKey: cacheKeyBuilder((args) => args[0]), hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async _categories(keyOrId: number | string): Promise<Category[]> {
    throw new Error(
      `Please run 'category list -v ${
        (this.constructor as typeof Vendor).VENDOR_NAME
      } -u ${this.getUsername()} -p ${keyOrId}' command to get categories first.`,
    )
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async _login(): Promise<CacheRequestConfig> {
    throw new Error(
      `Please run 'vendor login ${
        (this.constructor as typeof Vendor).VENDOR_NAME
      } -u ${this.getUsername()}' command to login first.`,
    )
  }

  protected abstract getBanks(): Promise<Bank[]>

  protected abstract getCategories(keyOrId: number | string): Promise<Category[]>

  protected abstract toLogin(password: string): Promise<CacheRequestConfig>
}

// Vendor class type
type VendorClass = new (username: string) => Vendor

// Export
export {HashKeyScope, Vendor, VendorClass, cacheKeyBuilder, hashKeyBuilder}
