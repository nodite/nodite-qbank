import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import learnabc from '../../../utils/vendor/learnabc.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/learnabc/markji.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class LearnABC extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '英语习题册'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

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

    // fetch questions.
    switch (params.bank.meta?.type) {
      case 'grammar': {
        for (const [_idx, _content] of (params.sheet.meta?.contents || []).entries()) {
          const _qId = String(_idx)

          const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
            ...cacheKeyParams,
            questionId: _qId,
          })

          if (originQuestionKeys.includes(_qCacheKey)) continue

          await cacheClient.set(_qCacheKey, _content)
          originQuestionKeys.push(_qCacheKey)
          emitter.emit('questions.fetch.count', originQuestionKeys.length)
        }

        break
      }

      case 'stage':
      case 'topic': {
        let _id = 0

        do {
          if (originQuestionKeys.length >= params.sheet.count) break

          const _respParams: Record<string, any> =
            _id === 0 ? {firstTimeEnter: true, id: _id} : {id: _id, isNextPaper: true}

          // topic.
          if (params.bank.meta?.type === 'topic') {
            _respParams.topic_id = params.bank.meta?.topic.id
          }
          // stage.
          else if (params.bank.meta?.type === 'stage') {
            _respParams.stage = params.bank.meta?.stage.key
            _respParams.category = params.category.id
          }
          // others.
          else if (params.bank.meta?.type) {
            throwError('Not implemented', {params})
          }

          const _qResp = await axios.get(
            'http://m.beauty-story.cn/api/englishpaper/cq',
            lodash.merge({}, config, {params: _respParams}),
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

            await sleep(200)
          }

          _id = _qs.at(-1)?.id
        } while (Number(_id) > 0)

        break
      }

      default: {
        throwError('Not implemented', {params})
      }
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    const config = await this.login()

    const _sheets = [] as Sheet[]

    if (params.bank.meta?.type === 'grammar') {
      const contents = await Promise.all(
        lodash.map(params.category.meta?.articles, async (art) => {
          return (
            await axios.get(
              'http://api.beauty-story.cn/api/learnabc/grammar_article_content',
              lodash.merge({}, config, {params: art}),
            )
          ).data.data
        }),
      )

      _sheets.push({
        count: params.category.count,
        id: '0',
        meta: {contents},
        name: '默认',
      })
    }

    return _sheets
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const config = await this.login()

    const banks = [] as Bank[]

    // topic.
    const _topicResp = await axios.get('http://m.beauty-story.cn/api/englishpaper/getTopicList', config)

    for (const [_idx, _topic] of (_topicResp.data.data || []).entries()) {
      const _id = md5(JSON.stringify({id: _topic.id, type: 'topic'}))

      banks.push({
        count: Number(_topic.paper_count),
        id: _id,
        meta: {
          _index: _idx,
          name: _topic.topic_name,
          topic: _topic,
          type: 'topic',
        },
        name: await safeName(`英语习题册 > 语法 > ${_topic.topic_name}`),
      })
    }

    // stage.
    const _stageResp = await axios.get('http://m.beauty-story.cn/api/englishpaper/allcategory2', config)

    for (const [_idx, _stage] of (_stageResp.data.data.active || []).entries()) {
      const _stgKey = _stage.stage
      const _stgMeta = lodash.find(_stageResp.data.data.stage, {key: _stgKey})

      banks.push({
        id: md5(JSON.stringify({stage: _stgKey})),
        meta: {
          _index: _idx,
          categories: lodash.map(_stage.category, (c) => {
            const _catMeta = lodash.find(_stageResp.data.data.category, {key: c.key})
            return {..._catMeta, ...c}
          }),
          name: _stgMeta.value,
          stage: _stgMeta,
          type: 'stage',
        },
        name: await safeName(`英语习题册 > 阶段 > ${_stgMeta.value}`),
      })
    }

    // 语法
    const _articleResp = await axios.get('http://api.beauty-story.cn/api/learnabc/grammar_list', config)

    for (const [_idx, _grammar] of (_articleResp.data.data || []).entries()) {
      banks.push({
        count: _grammar.article_count,
        id: md5(String(_grammar.id)),
        meta: {
          _index: _idx,
          grammar: _grammar,
          type: 'grammar',
        },
        name: await safeName(`英语习题册 > 文章 > ${_grammar.title}`),
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

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const _cats = [] as Category[]

    switch (params.bank.meta?.type) {
      case 'grammar': {
        _cats.push({
          children: [],
          count: params.bank.count || 0,
          id: '0',
          meta: {
            articles: (
              await axios.get(
                'http://api.beauty-story.cn/api/learnabc/grammar_article_list',
                lodash.merge({}, config, {params: {category_name: params.bank.meta?.grammar.title}}),
              )
            ).data.data,
          },
          name: '默认',
        })
        break
      }

      case 'stage': {
        for (const [_idx, _cat] of params.bank.meta.categories.entries()) {
          _cats.push({
            children: [],
            count: _cat.count,
            id: _cat.key,
            name: await safeName(_cat.value),
            order: _idx,
          })
        }

        break
      }

      case 'topic': {
        _cats.push({
          children: [],
          count: params.bank.count || 0,
          id: '0',
          name: params.bank.meta.topic.topic_name,
        })

        break
      }

      default: {
        _cats.push({children: [], count: params.bank.count || 0, id: '0', name: '默认'})

        break
      }
    }

    return _cats
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig> {
    return {
      headers: {
        Host: 'm.beauty-story.cn',
        'User-Agent': 'AllPaper/3 CFNetwork/1568.200.51 Darwin/24.1.0',
      },
    }
  }
}
