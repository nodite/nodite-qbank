import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {HTMLElement, parse} from 'node-html-parser'
import {Page} from 'puppeteer'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cacheManager from '../../../cache/cache.manager.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/itexams/markji.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

/**
 * ITExams.
 * @see https://www.itexams.com/
 */
export default class ITExams extends Vendor {
  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  protected get itxVendor(): string {
    throw new Error('Not implemented')
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const resp = await axios.get(this.itxVendor)

    const elements = parse(resp.data).querySelectorAll('.list-group-item > a')

    const banks = [] as Bank[]

    for (const element of elements) {
      const href = element.getAttribute('href')
      const name = element.textContent?.trim()

      banks.push({
        id: md5(String(href)),
        meta: {
          href: `https://www.itexams.com${href}`,
          name,
        },
        name: await safeName(String(name)),
      })
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(_qbank: {bank: Bank}): Promise<Category[]> {
    const resp = await axios.get(_qbank.bank.meta?.href)

    const root = parse(resp.data)

    const countElement = lodash.find(root.querySelectorAll('.info-list > li'), (element: HTMLElement) =>
      element?.textContent?.includes('Exam Questions'),
    )

    const count = countElement?.textContent?.match(/(\d+)/)?.[1] ?? 0

    const exam = root.querySelector('.goto_exam > a')?.getAttribute('href')

    return [
      {
        children: [],
        count: Number(count),
        id: md5('0'),
        meta: {
          exam: `https://www.itexams.com${exam}`,
        },
        name: '默认',
        order: 0,
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
    lodash.set(qbank, 'vendor', this)

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
      let pager: Page | undefined
      let page = 1

      let _preQ: string = ''

      do {
        if (pager) {
          await pager.click('button[title="Next Page"]')
          await pager.solveRecaptchas()
          // @see https://github.com/berstend/puppeteer-extra/issues/916
          throw new Error('Not implemented')
          // const button =
          //   '<button data-toggle="tooltip" data-placement="right" title="Next Page"' +
          //   `class="open-captcha" data-page="${page}"></button>`
        } else {
          pager = await puppeteer.page('itexams', qbank.category.meta!.exam)
        }

        const html = await pager.content()
        const root = parse(html)

        const _nowQ = root.querySelector('.question_text')?.textContent

        if (_preQ === _nowQ) {
          throwError('Duplicate!', {page, qbank})
        }

        _preQ = _nowQ as string

        const cards = root.querySelectorAll('#accordion > .card')

        for (const [_idx, _card] of cards.entries()) {
          const _qId = String(_idx + (page - 1) * 5)

          const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
            ...cacheKeyParams,
            questionId: _qId,
          })

          if (orgQKeys.includes(_qCacheKey)) continue

          await cacheClient.set(_qCacheKey, _card.toString())

          orgQKeys.push(_qCacheKey)

          emitter.emit('questions.fetch.count', orgQKeys.length)

          // delay.
          await sleep(100)
        }

        if (orgQKeys.length >= qbank.sheet.count) break

        if (cards.length < 5) break

        if (cards.length === 0) {
          throwError('No questions found.', {page, qbank})
        }

        page++
      } while (true)
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(qbank: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: qbank.category.count, id: md5('0'), name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig> {
    return {}
  }
}
