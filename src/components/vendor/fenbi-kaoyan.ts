import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
// import lodash from 'lodash'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import axios from '../../utils/axios.js'
import {PUBLIC_KEY, encrypt} from '../../utils/fenbi.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from './main.js'

export default class FenbiKaoyan extends Vendor {
  public static VENDOR_NAME: string = 'fenbi-kaoyan'

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  public async getBankList(): Promise<Bank[]> {
    const requestConfig = await this.getRequestConfig()

    const response = await axios.get('https://schoolapi.fenbi.com/kaoyan/api/kaoyan/selected_quiz_list', requestConfig)

    if (response.data.length === 0) {
      throw new Error('请前往 <粉笔考研> App 加入题库')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.data.map((bank: any) => ({
      id: [bank.courseSet.id ?? 'unknown', bank.course.id ?? 'unknown', bank.quiz.id ?? 'unknown'].join('|'),
      name: [bank.courseSet.name ?? 'unknown', bank.course.name ?? 'unknown', bank.quiz.name ?? 'unknown'].join('｜'),
      prefix: [bank.courseSet.prefix ?? 'unknown', bank.course.prefix ?? 'unknown', bank.quiz.prefix ?? 'unknown'].join(
        '|',
      ),
    }))
  }

  @Cacheable({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  public async login(password: string): Promise<CacheRequestConfig> {
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
