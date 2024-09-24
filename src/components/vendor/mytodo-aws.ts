import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {emitter} from '../../utils/event.js'
import puppeteer from '../../utils/puppeteer.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../cache-pattern.js'
import {OutputClass} from '../output/common.js'
import Markji from '../output/mytodo/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from './common.js'

export default class MyTodoAws extends Vendor {
  public static META = {key: 'mytodo-aws', name: 'AWS'}

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

    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/', {cookies: config.params.cookies})

    await page.waitForSelector('.card-body')

    const banks: Bank[] = await page.$$eval('.card-body', (elements) =>
      elements.map((element, index) => {
        const id = element.querySelector('.card-title')?.textContent?.trim()
        const name = element.querySelector('.card-text')?.textContent?.trim()

        return {id: String(id?.toLowerCase()), key: String(id?.toLowerCase()), name: String(name), order: index}
      }),
    )

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/', {cookies: config.params.cookies})

    await Promise.all([
      page.waitForSelector('a[id^=sheet]'),
      page.goto(`https://mytodo.vip/subjects/detail?type=1&category=${params.bank.id}`),
    ])

    // a id="sheet*", * is count
    const count: number =
      lodash.max(
        await page.$$eval('a[id^=sheet]', (elements) =>
          elements.map((element) => Number(element.id.replace('sheet', ''))),
        ),
      ) || 0

    return [{children: [], count, id: '0', name: 'mytodo', order: 0}]
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    // prepare
    const cacheClient = this.getCacheClient()
    const config = await this.login()

    // cache key
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
      // for loop params.sheet.count
      for (let i = 1; i <= params.sheet.count; i++) {
        const _questionId = String(i)

        const _questionCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _questionId,
        })

        if (originQuestionKeys.includes(_questionCacheKey)) continue

        const page = await puppeteer.page(
          'mytodo',
          `https://mytodo.vip/subjects/detail?type=1&category=${params.bank.id}&sid=${_questionId}`,
          {cookies: config.params.cookies},
        )

        await page.waitForSelector('div[id=answerExplanation]')

        // get html from div[class=container]
        const html = await page.$eval('div[class=container] > div:first-of-type', (element) => element.outerHTML)

        await cacheClient.set(_questionCacheKey, html)

        originQuestionKeys.push(_questionCacheKey)

        emitter.emit('questions.fetch.count', originQuestionKeys.length)

        await page.close()

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
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await puppeteer.page('mytodo', 'https://mytodo.vip/login')

    await page.type('input[name=floatingInput]', this.getUsername())
    await page.type('input[name=floatingPassword]', password)
    await Promise.all([page.waitForNavigation(), page.click('button[type=submit]')])

    const cookies = await page.cookies()

    return {
      params: {cookies},
    }
  }
}
