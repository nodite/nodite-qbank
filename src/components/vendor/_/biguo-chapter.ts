import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'

import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {LoginOptions, QBankParams} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import {safeName} from '../../../utils/index.js'
import axios from '../../axios/index.js'
import {cacheKeyBuilder, HashKeyScope} from '../common.js'
import BiguoReal from './biguo-real.js'

export default class BiguoChapter extends BiguoReal {
  public static META = {key: path.parse(import.meta.url).name, name: '笔果章节'}

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const response = await axios.get(
      'https://www.biguotk.com/api/v4/exams/chapter_section_list',
      lodash.merge(config, {params: {courses_id: params.bank.meta?.courseId}}),
    )

    const categories: Category[] = []

    for (const [_idx, _group] of lodash.get(response, 'data.data', []).entries()) {
      const _children: Category[] = []

      for (const [_section_idx, _section] of _group.sections.entries()) {
        _children.push({
          children: [],
          count: _section.total_nums,
          id: _section.section_id,
          meta: {version: _section.version},
          name: await safeName(_section.name),
          order: _section_idx,
        })
      }

      categories.push({
        children: _children,
        count: _group.total_nums,
        id: _group.id,
        name: await safeName(_group.name),
        order: _idx,
      })
    }

    return categories
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    return params.category.children
  }

  /**
   * Login.
   */
  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new BiguoReal(this.getUsername()).login(options)
  }

  /**
   * _biguoQuestionBankParam.
   */
  protected _biguoQuestionBankParam(qbank?: QBankParams): Record<string, any> {
    return {
      code: qbank?.sheet.id,
      mainType: 5,
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
}
