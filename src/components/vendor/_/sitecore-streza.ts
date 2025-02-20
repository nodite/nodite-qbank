import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {HTMLElement, parse} from 'node-html-parser'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/streza/markji.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class SitecoreStreza extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'Sitecore'}

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
    const resp = await axios.get('https://www.sitecoregabe.com/search/label/exam')

    const as = parse(resp.data).querySelectorAll('.post-title > a')

    const banks = [] as Bank[]

    for (const a of as) {
      const href = a.getAttribute('href')

      if (!href) continue

      const name = a.textContent.split(':')[0].trim()
      const id = md5(name)

      banks.push({id, meta: {href}, name: await safeName(name)})
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(qbank: {bank: Bank}): Promise<Category[]> {
    const resp = await axios.get(qbank.bank.meta?.href)

    const as = parse(resp.data).querySelectorAll('a[href^="https://streza.dev"]')

    const a = lodash.find(as, (a: HTMLElement) => {
      return a.getAttribute('href')?.includes('/app')
    }) as HTMLElement

    if (!a || !a.getAttribute('href')) {
      throwError('找不到题库', {qbank})
    }

    const qsHref = a.getAttribute('href')!.replace('/app', '/data.json')
    const qs = await axios.get(qsHref)

    return [
      {
        children: [],
        count: qs.data?.metadata?.totalQuestions || qs.data?.questions?.length || 0,
        id: md5('0'),
        meta: {href: a.getAttribute('href'), json: qsHref},
        name: '默认',
      },
    ]
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    qbank: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    // prepare
    const cacheClient = this.getCacheClient()

    // cache key
    const cacheKeyParams = {
      bankId: qbank.bank.id,
      categoryId: qbank.category.id,
      sheetId: qbank.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const orgQKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      orgQKeys.length = 0
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    if (orgQKeys.length < qbank.sheet.count) {
      const qs = await axios.get(qbank.category.meta?.json || '')

      for (const [_qIdx, _q] of (qs.data?.questions || []).entries()) {
        const _qId = String(_qIdx)

        const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _qId,
        })

        if (orgQKeys.includes(_qCacheKey)) continue

        await cacheClient.set(_qCacheKey, _q)

        orgQKeys.push(_qCacheKey)

        emitter.emit('questions.fetch.count', orgQKeys.length)

        // delay.
        await sleep(100)
      }
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: md5('0'), name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig> {
    return {}
  }
}
