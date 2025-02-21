import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {LoginOptions, QBankParams} from '../../../@types/common.js'
import {cacheKeyBuilder, HashKeyScope} from '../common.js'
import BiguoReal from './biguo-real.js'

export default class BiguoVip extends BiguoReal {
  public static META = {key: path.parse(import.meta.url).name, name: '笔果💯'}

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new BiguoReal(this.getUsername()).login(options)
  }

  protected _biguoQuestionBankParam(qbank?: QBankParams): Record<string, any> {
    return {
      code: qbank?.bank.meta?.courseCode,
      mainType: 4,
      professions_id: qbank?.bank.meta?.professionId,
      province_id: qbank?.bank.meta?.provinceId,
      public_key:
        'LS0tLS1CRUdJTiBSU0EgUFVCTElDIEtFWS0' +
        'tLS0tCk1JR0pBb0dCQUxjNmR2MkFVaWRTR3' +
        'NNTlFmS0VtSVpQZVRqeWRxdzJmZ2ErcGJXa' +
        '3B3NGdrc09GR1gyWVRUOUQKOFp6K3FhWDJr' +
        'eWFsYi9xU1FsN3VvMVBsZTd6UVBHbU01RXo' +
        'yL2ErSU9TZVZYSTIxajBTZXV1SzJGZXpEcV' +
        'NtTwpRdEQzTDNJUWFhSURmYUx6NTg3MFNVc' +
        'CswRVBlZ2JkNTB3dEpqc2pnZzVZenU4WURP' +
        'ZXg1QWdNQkFBRT0KLS0tLS1FTkQgUlNBIFB' +
        'VQkxJQyBLRVktLS0tLQ==',
      school_id: qbank?.bank.meta?.schoolId,
    }
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    return [{children: [], count: params.bank.count || 0, id: '0', name: '默认'}]
  }
}
