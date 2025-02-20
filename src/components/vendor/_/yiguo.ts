import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import axios from 'axios'
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

export default class Yiguo extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '羿过题库'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    throw new Error('Method not implemented.')
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_params: {bank: Bank}): Promise<Category[]> {
    throw new Error('Method not implemented.')
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const _headers = {
      interfaceType: 'app',
      'User-Agent': 'YiGuoEduApp/1.5.2 (iPhone; iOS 18.0.1; Scale/3.00)',
    }

    const _resp = await axios.post(
      'https://www.yiguojy.com/huikao_mobile/app_login_by_pwd',
      {
        password: md5(password),
        userPhone: this.getUsername(),
      },
      {
        headers: {
          ..._headers,
          Authorization: '',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      },
    )

    return {
      headers: {
        ..._headers,
        Authorization: _resp.data.data.token,
      },
    }
  }
}
