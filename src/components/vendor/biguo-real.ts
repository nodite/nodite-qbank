import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions, Params} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {emitter} from '../../utils/event.js'
import {safeName} from '../../utils/index.js'
import biguo from '../../utils/vendor/biguo.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../cache-pattern.js'
import Markji from '../output/biguo/markji.js'
import {OutputClass} from '../output/common.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class BiguoReal extends Vendor {
  public static META = {key: 'biguo-real', name: '笔果真题'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const LIMIT = [{province_name: '福建省', school_name: '福州大学'}]

    const requestConfig = await this.login()

    const cityResponse = await axios.get('https://www.biguotk.com//api/v5/getZkCity', requestConfig)

    const provinces = lodash
      .chain(cityResponse.data.data)
      .map('list')
      .flatten()
      .map((city) => ({province_id: city.province_id, province_name: city.province_name}))
      .uniqBy('province_id')
      .filter((province) => lodash.map(LIMIT, 'province_name').includes(province.province_name))
      .value()

    const banks = [] as Bank[]

    // provinces.
    for (const province of provinces) {
      const schoolResponse = await axios.post(
        'https://www.biguotk.com//api/schoolList',
        {province_id: province.province_id},
        requestConfig,
      )

      const schools = lodash
        .chain(schoolResponse.data.data)
        .filter((school) => lodash.map(LIMIT, 'school_name').includes(school.name))
        .value()

      // schools.
      for (const school of schools) {
        const professionResponse = await axios.post(
          'https://www.biguotk.com//api/v2/professions',
          {province_id: province.province_id, school_id: school.id, schoolName: school.name},
          requestConfig,
        )

        // professions.
        for (const profession of professionResponse.data.data) {
          banks.push({
            id: [province.province_id, school.id, profession.id].join('|'),
            key: [province.province_id, school.id, profession.id].join('|'),
            name: await safeName(
              [province.province_name, school.name, `${profession.name}(${profession.code})`].join(' > '),
            ),
          })
        }
      }
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const requestConfig = this.login()
    const [provinceId, schoolId, professionId] = bank.id.split('|')

    const courseResponse = await axios.get(
      'https://www.biguotk.com/api/v4/study/user_courses',
      lodash.merge({}, requestConfig, {
        params: {professions_id: professionId, province_id: provinceId, school_id: schoolId},
      }),
    )

    const courses = lodash.merge(
      [],
      courseResponse.data.data.courses_joined,
      courseResponse.data.data.courses_not_joined,
      courseResponse.data.data.courses_passed,
    )

    const categories = [] as Category[]

    for (const course of courses) {
      const homeResponse = await axios.get(
        'https://www.biguotk.com/api/v4/study/home',
        lodash.merge({}, requestConfig, {
          params: {
            courses_id: course.courses_id,
            professions_id: professionId,
            province_id: provinceId,
            school_id: schoolId,
          },
        }),
      )

      categories.push({
        children: [],
        count: lodash.find(homeResponse.data.data.tikus, {type: this._biguoQuestionBankParam().mainType}).total || 0,
        id: [course.courses_id, course.code].join('|'),
        name: await safeName(`${course.name}(${course.code})`),
      })
    }

    return categories
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    bank: Bank,
    category: Category,
    sheet: Sheet,
    options?: FetchOptions | undefined,
  ): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = this.login()

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const originQuestionKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      originQuestionKeys.length = 0
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)

    if (originQuestionKeys.length < sheet.count) {
      const questionBankResponse = await axios.get(
        'https://www.biguotk.com/api/v5/exams/getQuestionBank',
        lodash.merge({}, requestConfig, {
          params: this._biguoQuestionBankParam({bank, category, sheet, vendor: this}),
        }),
      )

      const fileUrls = lodash.get(questionBankResponse.data, 'data.fileUrls')

      const questions = (
        await Promise.all(
          lodash.map(fileUrls, async (fileUrl) => {
            const resp = await axios.get(`https://cdn.biguotk.com/${fileUrl}`)
            return resp.data.topics || []
          }),
        )
      ).flat()

      for (const _question of questions) {
        const _questionId = String(_question.id)

        const _questionCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _questionId,
        })

        if (originQuestionKeys.includes(_questionCacheKey)) continue

        _question.questionAsk = await biguo.showQuestionAsk(biguo.PUBLIC_KEY, _question.questionAsk)
        _question.sheet = sheet

        await cacheClient.set(_questionCacheKey, _question)

        originQuestionKeys.push(_questionCacheKey)

        emitter.emit('questions.fetch.count', originQuestionKeys.length)

        // delay.
        await sleep(100)
      }
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)

    await sleep(1000)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(bank: Bank, category: Category): Promise<Sheet[]> {
    const requestConfig = this.login()
    const [provinceId, schoolId, professionId] = bank.id.split('|')
    const [courseId] = category.id.split('|')

    const realResponse = await axios.get(
      'https://www.biguotk.com/api/v4/exams/real_paper_list',
      lodash.merge({}, requestConfig, {
        params: {
          courses_id: courseId,
          limit: 100,
          page: 1,
          professions_id: professionId,
          province_id: provinceId,
          school_id: schoolId,
        },
      }),
    )

    return Promise.all(
      lodash.map(realResponse.data.data, async (sheet) => ({
        count: sheet.total_nums,
        id: sheet.id,
        name: await safeName(sheet.name),
      })),
    )
  }

  @Cacheable({
    cacheKey: (_, context) => context.getUsername(),
    hashKey: hashKeyBuilder(HashKeyScope.LOGIN),
  })
  protected async toLogin(password: string): Promise<CacheRequestConfig<any, any>> {
    const userAgent = 'Biguo_Pro/6.9.1 (com.depeng.biguo; build:2; iOS 17.5.1) Alamofire/5.9.1'

    const response = await axios.post(
      'https://www.biguotk.com/api/user/login',
      {
        mobile: this.getUsername(),
        password,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
      },
    )

    return {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: (response.headers['set-cookie'] ?? []).join('; '),
        'User-Agent': userAgent,
        token: response.data.data.token,
      },
      params: {
        cert_type: 0,
        layer_id: 1,
        users_id: response.data.data.user_id,
      },
    }
  }

  /**
   * _biguoQuestionBankParam.
   */
  protected _biguoQuestionBankParam(params?: Params): Record<string, any> {
    const [provinceId, schoolId, professionId] = params ? params.bank.id.split('|') : [undefined, undefined, undefined]

    return {
      code: params?.sheet?.id,
      mainType: 2,
      professions_id: professionId,
      province_id: provinceId,
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
      school_id: schoolId,
    }
  }
}
