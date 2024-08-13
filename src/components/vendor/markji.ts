import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {MarkjiSheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {OutputClass} from '../output/common.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class Markji extends Vendor {
  public static META = {key: 'markji', name: 'Markji'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {}
  }

  /**
   * Banks = Markji Folders.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const requestConfig = await this.login()

    const response = await axios.get('https://www.markji.com/api/v1/decks/folders', requestConfig)

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash.map(response.data.data.folders, (item) => ({
      id: item.id,
      key: item.id,
      name: item.name,
    }))
  }

  /**
   * Categories = Markji Decks.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      'https://www.markji.com/api/v1/decks',
      lodash.merge(requestConfig, {
        params: {
          folder_id: bank.id,
          limit: 3000,
          offset: 0,
        },
      }),
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash.map(response.data.data.decks, (item) => ({
      children: [],
      count: item.card_count,
      id: item.id,
      name: item.name,
    }))
  }

  public async fetchQuestions(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Sheet = Markji Chapters.
   */
  @Cacheable({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(bank: Bank, category: Category): Promise<MarkjiSheet[]> {
    const requestConfig = await this.login()

    const response = await axios.get(`https://www.markji.com/api/v1/decks/${category.id}/chapters`, requestConfig)

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return lodash.map(response.data.data.chapters, (item) => ({
      cardIds: item.card_ids,
      count: item.card_ids.length,
      id: item.id,
      name: item.name,
    }))
  }

  @Cacheable({cacheKey: (_, context) => context.getUsername(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    const response = await axios.post(
      'https://www.markji.com/api/v1/users/login',
      {
        identity: this.getUsername(),
        nuencrypt_fields: ['password'],
        password,
      },
      {
        headers: {
          'User-Agent': userAgent,
        },
      },
    )

    if (response.data.success === false) {
      throw new Error(response.data.errors)
    }

    return {
      headers: {
        'User-Agent': userAgent,
        token: response.data.data.token,
      },
    }
  }
}
