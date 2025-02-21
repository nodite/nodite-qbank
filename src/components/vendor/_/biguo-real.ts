import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions, QBankParams} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import biguo from '../../../utils/vendor/biguo.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_CUSTOM_ITEM, CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import Markji from '../../output/biguo/markji.js'
import {OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class BiguoReal extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '笔果真题'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions | undefined,
  ): Promise<void> {
    lodash.set(params, 'vendor', this)

    // prepare.
    const cacheClient = this.getCacheClient()
    const config = await this.login()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
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

    if (originQuestionKeys.length < params.sheet.count) {
      const _qbankParam = this._biguoQuestionBankParam({
        bank: params.bank,
        category: params.category,
        sheet: params.sheet,
        vendor: this,
      })

      const questionBankResponse = await axios.get(
        'https://www.biguotk.com/api/v5/exams/getQuestionBank',
        lodash.merge({}, config, {params: _qbankParam}),
      )

      const fileUrls = lodash.get(questionBankResponse.data, 'data.fileUrls', [])

      // buyer denied.
      if (lodash.isEmpty(questionBankResponse.data.data.fileUrls)) {
        const _topicCacheKey = lodash.template(CACHE_KEY_CUSTOM_ITEM)({
          ...cacheKeyParams,
          itemId: md5(JSON.stringify([_qbankParam.mainType, _qbankParam.code])),
          key: 'topic-types',
        })

        const _topicTypes: number[] = (await cacheClient.get(_topicCacheKey)) || []

        if (lodash.isEmpty(_topicTypes)) {
          _topicTypes.push(...lodash.shuffle(lodash.range(1, 31)))
        }

        const _version = params.sheet.meta?.version || params.category.meta?.version || params.bank.meta?.version

        if (!_version) {
          throwError('version is empty.', {params})
        }

        for (const _topicType of lodash.clone(_topicTypes)) {
          const _fileUrl = lodash.join(
            [
              'masterTopicList/topicList',
              `mainType_${_qbankParam.mainType}`,
              `code_${_qbankParam.code}`,
              `topicType_${_topicType}`,
              `version_${_version}.json`,
            ],
            '-',
          )

          try {
            await axios.get(`https://cdn.biguotk.com/${_fileUrl}`, {cache: {ttl: 1000 * 60 * 60 * 24}})
            fileUrls.push(_fileUrl)
          } catch {
            lodash.remove(_topicTypes, (item) => item === _topicType)
          }

          await sleep(lodash.random(100, 1000))
        }

        await cacheClient.set(_topicCacheKey, _topicTypes)
      }

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
        _question.sheet = params.sheet

        await cacheClient.set(_questionCacheKey, _question)

        originQuestionKeys.push(_questionCacheKey)

        emitter.emit('questions.fetch.count', originQuestionKeys.length)

        // delay.
        await sleep(100)
      }
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  protected _biguoQuestionBankParam(qbank?: QBankParams): Record<string, any> {
    return {
      code: qbank?.category?.id,
      mainType: 2,
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

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const LIMIT = [{profession_names: ['应用心理学（新）'], school_name: '福州大学'}]

    const config = await this.login()

    const cityResponse = await axios.get('https://www.biguotk.com/api/v5/getZkCity', config)

    const provinces = lodash
      .chain(cityResponse.data.data)
      .map('list')
      .flatten()
      .map((city) => ({province_id: city.province_id, province_name: city.province_name}))
      .uniqBy('province_id')
      .value()

    const banks = [] as Bank[]

    // provinces.
    for (const province of provinces) {
      const provinceId = province.province_id

      const schoolResponse = await axios.post(
        'https://www.biguotk.com/api/schoolList',
        {province_id: provinceId},
        config,
      )

      const schools = lodash
        .chain(schoolResponse.data.data)
        .filter((school) => lodash.map(LIMIT, 'school_name').includes(school.name))
        .value()

      // schools.
      for (const school of schools) {
        const schoolId = school.id

        const professionResponse = await axios.post(
          'https://www.biguotk.com//api/v2/professions',
          {province_id: provinceId, school_id: schoolId, schoolName: school.name},
          config,
        )

        // professions.
        for (const profession of professionResponse.data.data) {
          const professionId = profession.id

          const _limit_pnames = lodash
            .chain(LIMIT)
            .filter((item) => item.school_name === school.name)
            .map('profession_names')
            .flatten()
            .value()

          if (!lodash.some(_limit_pnames, (pname) => profession.name.includes(pname))) {
            continue
          }

          const courseResponse = await axios.get(
            'https://www.biguotk.com/api/v4/study/user_courses',
            lodash.merge({}, config, {
              params: {professions_id: professionId, province_id: provinceId, school_id: schoolId},
            }),
          )

          // courses.
          const courses = [
            ...(courseResponse.data.data.courses_joined || []),
            ...(courseResponse.data.data.courses_not_joined || []),
            ...(courseResponse.data.data.courses_passed || []),
          ]

          for (const course of courses) {
            const homeResponse = await axios.get(
              'https://www.biguotk.com/api/v4/study/home',
              lodash.merge({}, config, {
                params: {
                  courses_id: course.courses_id,
                  professions_id: professionId,
                  province_id: provinceId,
                  school_id: schoolId,
                },
              }),
            )

            const _tikuHome = lodash.find(homeResponse.data.data.tikus, {type: this._biguoQuestionBankParam().mainType})

            const _id = md5(JSON.stringify([provinceId, schoolId, professionId, course.courses_id, course.code]))

            banks.push({
              count: _tikuHome.total || 0,
              id: _id,
              meta: {
                courseCode: course.code,
                courseId: course.courses_id,
                professionId,
                provinceId,
                schoolId,
                version: _tikuHome.version,
              },
              name: await safeName(
                [school.name, `${profession.name}(${profession.code})`, `${course.name}(${course.code})`].join(' > '),
              ),
            })
          }
        }
      }
    }

    return lodash
      .chain(banks)
      .sortBy(['meta.schoolId', 'meta.professionId', 'meta.courseId'], ['asc', 'asc', 'asc'])
      .map((b, idx) => ({
        ...b,
        order: idx,
      }))
      .value()
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = this.login()

    const realResponse = await axios.get(
      'https://www.biguotk.com/api/v4/exams/real_paper_list',
      lodash.merge({}, config, {
        params: {
          courses_id: params.bank.meta?.courseId,
          limit: 100,
          page: 1,
          professions_id: params.bank.meta?.professionId,
          province_id: params.bank.meta?.provinceId,
          school_id: params.bank.meta?.schoolId,
        },
      }),
    )

    const categories = [] as Category[]

    for (const [idx, category] of (realResponse.data.data || []).entries()) {
      categories.push({
        children: [],
        count: category.total_nums,
        id: category.id,
        meta: {
          version: category.version,
        },
        name: await safeName(category.name),
        order: idx,
      })
    }

    return categories
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig<any, any>> {
    const userAgent = 'Biguo_Pro/6.9.1 (com.depeng.biguo; build:2; iOS 17.5.1) Alamofire/5.9.1'

    const response = await axios.post(
      'https://www.biguotk.com/api/user/login',
      {
        mobile: this.getUsername(),
        password,
      },
      {
        cache: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
      },
    )

    return {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'set-cookie': response.headers['set-cookie'] ?? [],
        token: response.data.data.token,
        'User-Agent': userAgent,
      },
      params: {
        cert_type: 0,
        layer_id: 1,
        users_id: response.data.data.user_id,
      },
    }
  }
}
