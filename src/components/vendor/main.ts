import type {CacheRequestConfig} from 'axios-cache-interceptor'

import cacheManager, {CacheClear, CacheKeyBuilder, Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_PREFIX, HashKeyScope} from '../cache-pattern.js'

/**
 * Hash key builder
 * @param scope
 * @param builder
 * @returns
 */
const hashKeyBuilder = (scope: HashKeyScope, builder?: CacheKeyBuilder): CacheKeyBuilder => {
  return (args, context): string => {
    const tempArgs: Record<string, string> = {scope}

    if (context instanceof Vendor) {
      tempArgs.vendorName = (context.constructor as typeof Vendor).VENDOR_NAME
      tempArgs.username = context.getUsername()
    } else if (args.length > 0 && args[0] instanceof Vendor) {
      tempArgs.vendorName = (args[0].constructor as typeof Vendor).VENDOR_NAME
      tempArgs.username = args[0].getUsername()
    }

    const hashKeyPrefix = lodash.template(CACHE_KEY_PREFIX)(tempArgs)

    return builder ? `${hashKeyPrefix}:${builder(args, context)}` : hashKeyPrefix
  }
}

/**
 * Vendor class
 */
abstract class Vendor {
  public static VENDOR_NAME: string

  public getCacheClient = () => this.cacheClient

  public getUsername = () => this.username

  private cacheClient = (cacheManager.default.client ?? cacheManager.default.fallbackClient) as cacheManager.CacheClient

  private username: string

  /**
   * Constructor
   * @param username
   */
  constructor(username: string) {
    this.username = username
  }

  /**
   * Banks.
   */
  public async banks(): Promise<Bank[]>

  public async banks(fromCache: true): Promise<Bank[]>

  public async banks(fromCache?: true): Promise<Bank[]> {
    return fromCache ? this._banks() : this.fetchBanks()
  }

  /**
   * Categories.
   */
  public async categories(bank: Bank): Promise<Category[]>

  public async categories(bank: Bank, fromCache: true): Promise<Category[]>

  public async categories(bank: Bank, fromCache?: true): Promise<Category[]> {
    const categories = await (fromCache ? this._categories(bank) : this.fetchCategories(bank))

    for (const category of categories) {
      const questionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
        bankId: bank.id,
        categoryId: category.id,
        scope: HashKeyScope.ORIGIN_QUESTIONS,
        username: this.getUsername(),
        vendorName: (this.constructor as typeof Vendor).VENDOR_NAME,
      })

      const questionCount = (await this.cacheClient.keys(questionItemCacheKey + ':*')).length

      category.fetch = questionCount >= category.count
    }

    return categories
  }

  /**
   * Invalidate cache.
   */
  public async invalidate(scope: HashKeyScope, bank?: Bank): Promise<void> {
    switch (scope) {
      case HashKeyScope.BANKS: {
        return this._banksInvalidate()
      }

      case HashKeyScope.CATEGORIES: {
        return bank ? this._categoriesInvalidate(bank) : Promise.resolve()
      }

      case HashKeyScope.LOGIN: {
        return this._loginInvalidate()
      }

      default: {
        throw new Error('Invalid scope')
      }
    }
  }

  /**
   * Login.
   */
  public async login(): Promise<CacheRequestConfig>

  public async login(password: string): Promise<CacheRequestConfig>

  public async login(password?: string): Promise<CacheRequestConfig> {
    return password === undefined ? this._login() : this.toLogin(password)
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async _banks(): Promise<Bank[]> {
    const vendorName = (this.constructor as typeof Vendor).VENDOR_NAME
    throw new Error(`Please run 'bank list -v ${vendorName} -u ${this.getUsername()}' command to get banks first.`)
  }

  @CacheClear({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async _banksInvalidate(): Promise<void> {}

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async _categories(bank: Bank): Promise<Category[]> {
    const vendorName = (this.constructor as typeof Vendor).VENDOR_NAME
    const command = `category list -v ${vendorName} -u ${this.getUsername()} -b ${bank.id}`
    throw new Error(`Please run '${command}' command to get categories first.`)
  }

  @CacheClear({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async _categoriesInvalidate(_bank: Bank): Promise<void> {}

  /**
   * Login.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async _login(): Promise<CacheRequestConfig> {
    const vendorName = (this.constructor as typeof Vendor).VENDOR_NAME
    throw new Error(`Please run 'vendor login ${vendorName} -u ${this.getUsername()}' command to login first.`)
  }

  @CacheClear({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async _loginInvalidate(): Promise<void> {}

  //
  // abstract
  //
  protected abstract fetchBanks(): Promise<Bank[]>

  protected abstract fetchCategories(bank: Bank): Promise<Category[]>

  public abstract fetchOriginQuestions(bank: Bank, category: Category): Promise<void>

  protected abstract toLogin(password: string): Promise<CacheRequestConfig>
}

// Vendor class type
type VendorClass = new (username: string) => Vendor

// Export
export {Vendor, VendorClass, hashKeyBuilder}

export {HashKeyScope} from '../cache-pattern.js'
