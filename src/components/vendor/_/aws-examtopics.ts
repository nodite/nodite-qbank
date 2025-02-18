import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import md5 from 'md5'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import cache from '../../../cache/cache.manager.js'
import {safeName} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import {OutputClass} from '../../output/common.js'
import Skip from '../../output/skip.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

/**
 * https://www.examtopics.cn/#
 */
export default class AwsExamtopics extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: 'AWS'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const banks = [] as Bank[]

    const page = await puppeteer.page('examtopics', 'https://www.examtopics.cn/#', await this.login())

    await page.waitForSelector('body > div.sec-spacer > div > div > div:nth-child(1)')

    const elements = await page.$$('body > div.sec-spacer > div > div > div:nth-child(1) li')

    for (const element of elements) {
      const a = await element.$('a')
      const name = await a?.evaluate((element) => element.textContent?.trim())
      const href = await a?.evaluate((element) => element.getAttribute('href'))

      banks.push({
        id: md5(String(href)),
        meta: {
          href: `https://www.examtopics.cn${href}`,
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
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const page = await puppeteer.page('examtopics', params.bank.meta!.href, await this.login())

    await page.waitForSelector('div.exam-view-header')

    // const countText = await page.$(
    //   'div.exam-view-header ' +
    //     '> div.row.d-print-none ' +
    //     '> div ' +
    //     '> div.card ' +
    //     '> div.card-body ' +
    //     '> div ' +
    //     '> ul ' +
    //     '> li:nth-child(2)',
    // )

    // const text = await countText?.evaluate((element) => element.textContent?.trim())
    // const count = Number(text?.replaceAll(',', '').match(/第\s*(\d+)\s*道题/)?.[1])

    throw new Error('Method not implemented.')
  }

  /**
   * Questions.
   */
  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
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
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cache.CommonClient})
  protected async toLogin(_password: string): Promise<CacheRequestConfig> {
    return {}
  }
}
