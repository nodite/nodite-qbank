import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {OutputClass} from '../output/common.js'
import File from '../output/file.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class Demo extends Vendor {
  public static META = {key: 'demo', name: 'Demo'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [File.META.key]: File,
    }
  }

  protected async fetchBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  protected async fetchCategories(_bank: Bank): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  public async fetchQuestions(_bank: Bank, _category: Category, _sheet: Sheet, _options?: FetchOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async fetchSheet(_bank: Bank, _category: Category, _options?: FetchOptions): Promise<Sheet[]> {
    throw new Error('Method not implemented.')
  }

  @Cacheable({
    cacheKey: (_, context) => context.getUsername(),
    hashKey: hashKeyBuilder(HashKeyScope.LOGIN),
  })
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    return {
      headers: {password},
      params: {username: this.getUsername()},
    }
  }
}
