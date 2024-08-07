import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import axios from '../../utils/axios.js'
import {PUBLIC_KEY, encrypt} from '../../utils/fenbi.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from './main.js'

export default class FenbiKaoyan extends Vendor {
  public static VENDOR_NAME: string = 'fenbi-kaoyan'

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async getBanks(): Promise<Bank[]> {
    const requestConfig = await this.login()

    const response = await axios.get('https://schoolapi.fenbi.com/kaoyan/api/kaoyan/selected_quiz_list', requestConfig)

    if (response.data.length === 0) {
      throw new Error('请前往 <粉笔考研> App 加入题库')
    }

    return lodash.map(response.data, (bank: unknown) => ({
      id: [
        lodash.get(bank, 'courseSet.id', ''),
        lodash.get(bank, 'course.id', ''),
        lodash.get(bank, 'quiz.id', ''),
      ].join('|'),
      key: [
        lodash.get(bank, 'courseSet.prefix', ''),
        lodash.get(bank, 'course.prefix', ''),
        lodash.get(bank, 'quiz.prefix', ''),
      ].join('|'),
      name: [
        lodash.get(bank, 'courseSet.name', ''),
        lodash.get(bank, 'course.name', ''),
        lodash.get(bank, 'quiz.name', ''),
      ].join('|'),
    }))
  }

  @Cacheable({cacheKey: cacheKeyBuilder((args) => args[0]), hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async getCategories(keyOrId: number | string): Promise<Category[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      `https://schoolapi.fenbi.com/kaoyan/api/${keyOrId}/categories`,
      lodash.merge(requestConfig, {params: {deep: true, level: 0}}),
    )

    const _convert = (category: Record<string, unknown>): Category => ({
      children: lodash.map(category.children ?? [], _convert),
      count: category.count as number,
      id: category.id as string,
      name: category.name as string,
    })

    return lodash.map(response.data, _convert)
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    const params = {
      app: 'kaoyan',
      av: 104,
      device_ua: userAgent,
      hav: 108,
      inhouse: 0,
      kav: 100,
      system: '17.5.1',
      version: '6.5.20',
    }

    const response = await axios.post(
      'https://login.fenbi.com/api/users/loginV2',
      {
        app: 'web',
        password: await encrypt(PUBLIC_KEY, password),
        persistent: 1,
        phone: this.getUsername(),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        params,
      },
    )

    // Check if login is successful
    if (response.data.code !== 1) {
      throw new Error(response.data.msg)
    }

    return {
      headers: {
        Cookie: (response.headers['set-cookie'] ?? []).join('; '),
        'User-Agent': userAgent,
      },
      params,
    }
  }
}
