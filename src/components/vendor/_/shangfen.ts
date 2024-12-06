import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import CryptoJS from 'crypto-js'
import {Base64} from 'js-base64'
import lodash from 'lodash'
import md5 from 'md5'
import path from 'node:path'
import sleep from 'sleep-promise'

import sqliteCache from '../../../cache/sqlite.manager.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {emitter} from '../../../utils/event.js'
import {safeName} from '../../../utils/index.js'
import shangfen from '../../../utils/vendor/shangfen.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/shangfen/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class Shangfen extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '上分题库'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const config = await this.login()

    const banks = [] as Bank[]

    // const _categories = await axios.get(
    //   'https://api.ixunke.cn/shangfentiku/api/category',
    //   lodash.merge({}, config, {params: {type: 'qBank'}}),
    // )

    // for (const _cgL1 of _categories.data.data) {
    //   if (!['本科自考'].includes(_cgL1.category)) continue

    //   for (const _cgL2 of _cgL1.children || []) {
    //     if (!_cgL2.category.includes('应用心理')) continue

    //     let currPage = 1

    //     do {
    //       // const _resp = await axios.get(
    //       //   'https://api.ixunke.cn/shangfentiku/api/questions_member',
    //       //   lodash.merge({}, config, {params: {myQBank: true, page: currPage, pageSize: 10}}),
    //       // )

    //       const _resp = await axios.get(
    //         'https://api.ixunke.cn/shangfentiku/api/q_bank',
    //         lodash.merge({}, config, {
    //           params: {
    //             categoryId: _cgL2.id,
    //             order: '-recommend',
    //             page: currPage,
    //             pageSize: 12,
    //             status: 1,
    //           },
    //         }),
    //       )

    //       for (const _bank of _resp.data.data || []) {
    //         const _id = md5(JSON.stringify([_cgL1.id, _cgL2.id, _bank.id]))
    //         banks.push({
    //           count: _bank.questionCount || _bank.questionNum,
    //           id: _id,
    //           meta: {
    //             bankId: _bank.id,
    //             category: [
    //               {id: _cgL1.id, name: _cgL1.category},
    //               {id: _cgL2.id, name: _cgL2.category},
    //             ],
    //           },
    //           name: await safeName(`${_cgL1.category} > ${_cgL2.category} > ${_bank.title}`),
    //         })
    //       }

    //       if (currPage >= _resp.data.totalPages) break

    //       currPage++

    //       await sleep(2000)
    //     } while (true)
    //   }
    // }

    let currPage = 1
    const pageSize = 10

    do {
      const _resp = await axios.get(
        'https://api.ixunke.cn/shangfentiku/api/questions_member',
        lodash.merge({}, config, {params: {myQBank: true, page: currPage, pageSize}}),
      )

      for (const _bank of _resp.data.data || []) {
        const _id = md5(JSON.stringify([_bank.id]))
        banks.push({
          count: _bank.questionCount || _bank.questionNum,
          id: _id,
          meta: {
            bankId: _bank.id,
            categoryIds: lodash.isString(_bank.categoryIds) ? _bank.categoryIds.split(',') : _bank.categoryIds,
          },
          name: await safeName(`${_bank.subtitle} > ${_bank.title}`),
        })
      }

      if (currPage >= _resp.data.totalPages) break

      currPage++

      await sleep(2000)
    } while (true)

    return lodash.orderBy(banks, ['meta.category.0.id', 'meta.category.1.id', 'name'], ['asc', 'asc', 'asc'])
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const chapters = await axios.get(
      'https://api.ixunke.cn/shangfentiku/api/chapter',
      lodash.merge({}, config, {params: {qBankId: params.bank.meta?.bankId}}),
    )

    const categories = [] as Category[]

    for (const _chapter of chapters.data.data) {
      const _children = [] as Category[]

      for (const _child of _chapter.children || []) {
        _children.push({
          children: [],
          count: _child.questionCount || 0,
          id: _child.id,
          name: await safeName(_child.title),
          order: _child.order,
        })
      }

      categories.push({
        children: _children,
        count: _chapter.questionCount || 0,
        id: _chapter.id,
        name: await safeName(_chapter.title),
        order: _chapter.order,
      })
    }

    return categories
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    const cacheClient = this.getCacheClient()

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

    const data = await this.getData(params)

    for (const _q of data) {
      const _qId = String(_q.id)

      const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
        ...cacheKeyParams,
        questionId: _qId,
      })

      if (originQuestionKeys.includes(_qCacheKey)) continue

      await cacheClient.set(_qCacheKey, _q)
      originQuestionKeys.push(_qCacheKey)
      emitter.emit('questions.fetch.count', originQuestionKeys.length)

      await sleep(500)
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    if (params.category.children.length === 0) {
      return [{count: params.category.count, id: '0', name: '默认'}]
    }

    return lodash.map(
      params.category.children,
      (category): Sheet => ({
        count: category.count,
        id: category.id,
        meta: category.meta,
        name: category.name,
        order: category.order,
      }),
    )
  }

  /**
   * Get data.
   */
  protected async getData(params: {bank: Bank; category: Category}): Promise<Record<string, any>[]> {
    const config = await this.login()

    const _resp = await axios.get(
      'https://api.ixunke.cn/shangfentiku/api/v1/question/sequence_practise_nestification',
      lodash.merge({}, config, {
        params: {chapterId: params.category.id, qBankId: params.bank.meta?.bankId, studentAnswer: 1},
      }),
    )

    const key = shangfen.decryptQuestion(_resp.data.data.optional.qEncrypt.key, shangfen.decryptKey())

    const questions = JSON.parse(shangfen.decryptQuestion(_resp.data.data.questions, key))

    return questions
  }

  public async login(password?: string): Promise<CacheRequestConfig> {
    const config = await super.login(password)

    if (config?.params?.token) {
      // s.base64Encode)(a.AES.encrypt(e+"#"+r,"ixunke").toString()+"#"+r)
      const _timestamp = Date.now()
      const _token = CryptoJS.AES.encrypt(`${config.params.token}#${_timestamp}`, 'ixunke').toString()
      const _sign = Base64.encode(`${_token}#${_timestamp}`)
      config.params.token = _sign
    }

    return config
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const _headers = {
      Referer: 'https://servicewechat.com/wx220f2ece144fc528/1/page-frame.html',
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0_1 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) ' +
        'Mobile/15E148 MicroMessenger/8.0.53(0x18003531) NetType/WIFI Language/zh_CN',
      'x-platform': 'mp',
      'x-systemType': 'ios',
    }

    const _resp = await axios.post(
      'https://api.ixunke.cn/shangfentiku/api/login/login',
      {
        app: true,
        password,
        username: this.getUsername(),
      },
      {headers: _headers},
    )

    return {
      headers: _headers,
      params: {
        app: true,
        systemType: 'ios',
        token: _resp.data.data.token,
      },
    }
  }
}
