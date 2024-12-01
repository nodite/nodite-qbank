import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
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
import {throwError} from '../../../utils/index.js'
import learnabc from '../../../utils/vendor/learnabc.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/learnabc/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class LearnABC extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '英语习题册'}

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

    // topic.
    const _topics = await axios.get('http://m.beauty-story.cn/api/englishpaper/getTopicList', config)

    for (const [_idx, _topic] of (_topics.data.data || []).entries()) {
      const _id = md5(JSON.stringify({id: _topic.id, type: 'topic'}))

      banks.push({
        count: Number(_topic.paper_count),
        id: _id,
        meta: {
          _index: _idx,
          topic_detail: _topic.topic_detail,
          topic_id: _topic.id,
          topic_name: _topic.topic_name,
          type: 'topic',
        },
        name: `英语习题册 > 语法 > ${_topic.topic_name}`,
      })
    }

    // others.
    // TODO

    return lodash
      .chain(banks)
      .sortBy(['meta.type', 'meta._index'], ['asc', 'asc'])
      .map((_bank, _idx) => ({..._bank, order: _idx}))
      .value()
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    return [{children: [], count: params.bank.count || 0, id: '0', name: '默认'}]
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    const config = this.login()
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

    // topic
    if (params.bank.meta?.type === 'topic') {
      let _id = 0

      do {
        if (originQuestionKeys.length >= params.sheet.count) break

        const _qResp = await axios.get(
          'http://m.beauty-story.cn/api/englishpaper/cq',
          lodash.merge(
            {},
            config,
            _id === 0
              ? {params: {firstTimeEnter: true, id: _id, topic_id: params.bank.meta?.topic_id}}
              : {params: {id: _id, isNextPaper: true, topic_id: params.bank.meta?.topic_id}},
          ),
        )

        const _qs: Record<string, any>[] = _qResp.data.data

        for (const _q of _qs) {
          const _qId = String(_q.id)

          const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
            ...cacheKeyParams,
            questionId: _qId,
          })

          if (originQuestionKeys.includes(_qCacheKey)) continue

          if (_q.decode_type === '2') {
            _q.shift_question = learnabc.decryptServer(_q.shift_question)
            _q.shift_analyzing = learnabc.decryptServer(_q.shift_analyzing)
          } else {
            _q.shift_question = learnabc.decryptQuestion(_q.shift_question)
            _q.shift_analyzing = learnabc.decryptAnalyzing(_q.shift_analyzing)
          }

          await cacheClient.set(_qCacheKey, _q)
          originQuestionKeys.push(_qCacheKey)
          emitter.emit('questions.fetch.count', originQuestionKeys.length)

          await sleep(500)
        }

        _id = _qs.at(-1)?.id
      } while (true)
    }
    // others.
    else if (params.bank.meta?.type) {
      throwError('Not implemented', {params})
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)
    await sleep(1000)
    emitter.closeListener('questions.fetch.count')
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
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig> {
    return {
      headers: {
        Host: 'm.beauty-story.cn',
        'User-Agent': 'AllPaper/3 CFNetwork/1568.200.51 Darwin/24.1.0',
      },
    }
  }
}
