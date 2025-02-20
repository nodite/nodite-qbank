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
import {safeName} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import cookie from '../../axios/plugin/cookie.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/mytodo/markji.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class AwsMytodo extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'AWS'}

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

    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/', config)

    await page.waitForSelector('.card-body')

    const elements = await page.$$('.card-body')

    for (const element of elements) {
      const category = await (await element.$('.card-title'))?.evaluate((element) => element.textContent?.trim())
      const name = await (await element.$('.card-text'))?.evaluate((element) => element.textContent?.trim())

      banks.push({
        id: md5(String(category?.toLowerCase())),
        meta: {
          category: String(category?.toLowerCase()),
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
  protected async fetchCategories(qbank: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/', config)

    await Promise.all([
      page.waitForSelector('a[id^=sheet]'),
      page.goto(`https://mytodo.vip/subjects/detail?type=1&category=${qbank.bank.meta?.category}`),
    ])

    // a id="sheet*", * is count
    const count: number =
      lodash.max(
        await page.$$eval('a[id^=sheet]', (elements) =>
          elements.map((element) => Number(element.id.replace('sheet', ''))),
        ),
      ) || 0

    return [{children: [], count, id: md5('0'), name: '默认', order: 0}]
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
    const config = await this.login()

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
      // for loop params.sheet.count
      for (let i = 1; i <= qbank.sheet.count; i++) {
        const _qId = String(i)

        const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _qId,
        })

        if (orgQKeys.includes(_qCacheKey)) continue

        const page = await puppeteer.page(
          'mytodo',
          `https://mytodo.vip/subjects/detail?type=1&category=${qbank.bank.meta?.category}&sid=${_qId}`,
          config,
        )

        await page.waitForSelector('div[id=answerExplanation]')

        // get html from div[class=container]
        const html = await page.$eval('div[class=container] > div:first-of-type', (element) => element.outerHTML)

        await cacheClient.set(_qCacheKey, html)

        orgQKeys.push(_qCacheKey)

        emitter.emit('questions.fetch.count', orgQKeys.length)

        await page.close()

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
  public async fetchSheet(qbank: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: qbank.category.count, id: md5('0'), name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/login')

    await page.type('input[name=floatingInput]', this.getUsername())
    await page.type('input[name=floatingPassword]', password)
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')])

    const cookies = await page.browser().cookies()

    return {
      headers: {
        'set-cookie': cookies.map((_ck) => cookie.toString(_ck)),
      },
    }
  }
}
