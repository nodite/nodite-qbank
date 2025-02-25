import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {AxiosRequestConfig} from 'axios'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions, LoginOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import deepseek from '../../../utils/deepseek.js'
import {emitter} from '../../../utils/event.js'
import {throwError} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import Markji from '../../output/chaoxing/markji.js'
import {OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'
import ChaoXing from './chaoxing.js'

/**
 * @see https://github.com/aglorice/new_xxt/blob/red/my_xxt/api.py
 */
export default class ChaoXingWork extends ChaoXing {
  public static META = {key: path.parse(import.meta.url).name, name: '超星作业'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

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

    const orgQKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      orgQKeys.length = 0
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    for (const question of params.category.meta?.questions ?? []) {
      const qs = await this.chaoxingHtmlToJson(question, params)

      for (const q of qs) {
        const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: q.练习ID,
        })

        if (orgQKeys.includes(_qCacheKey)) continue

        await cacheClient.set(_qCacheKey, q)
        orgQKeys.push(_qCacheKey)
        emitter.emit('questions.fetch.count', orgQKeys.length)
      }
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new ChaoXing(this.getUsername()).login(options)
  }

  protected async chaoxingHtmlToJson(
    html: any,
    params: {bank: Bank; category: Category; sheet: Sheet},
  ): Promise<any[]> {
    const schema = {
      A: '',
      Analyze: '',
      B: '',
      C: '',
      D: '',
      E: '',
      ExerGroupId: '',
      F: '',
      G: '',
      H: '',
      KeyType: '',
      origin: html,
      ReviewExerGroupID: '',
      RightKey: '',
      Title: '',
      一级目录: '',
      三级目录: '',
      二级目录: '',
      分数: '',
      多选题得分规则: '',
      所属部分: '',
      材料: '',
      模考ID: '',
      目录ID: '0',
      练习ID: '',
      课程ID: params.bank.meta?.courseId,
      课程名称: params.bank.meta?.courseName,
      选项数: '',
      题型: '',
      题目序号: '',
    } as Record<string, any>

    const root = parse(html).querySelector('> div')
    schema.KeyType = root!.getAttribute('typename')!

    const _returns = [] as any[]

    switch (schema.KeyType) {
      case '判断题':
      case '单选题':
      case '多选题': {
        const title = root!.querySelector('h3:first-child')?.textContent.trim() || ''
        const stemAnswer = root!.querySelectorAll('div.stem_answer > div') || []

        schema.Title = title.replace(`(${schema.KeyType})`, '').trim()
        schema.选项数 = stemAnswer.length
        schema.练习ID = root?.getAttribute('data')

        for (const stem of stemAnswer) {
          const point = stem.querySelector('span:first-child')?.getAttribute('data') || ''
          const text = stem.querySelector('div:last-child')?.textContent
          schema[point] = text
        }

        _returns.push(schema)

        break
      }

      case '完型填空': {
        for (const q of root!.querySelectorAll('div.clozeTextQues > div')) {
          const _schema = structuredClone(schema)

          _schema.材料 = root!.querySelector('h3:first-child')?.textContent.trim()

          const _stemAnswer = q.querySelectorAll('div > div.stem_answer > div') || []

          _schema.Title = '第 ' + (q.querySelector('div > span')?.textContent.trim() || '') + ' 空'
          _schema.选项数 = _stemAnswer.length
          _schema.练习ID = (root?.getAttribute('data') || '') + '+' + q.getAttribute('data')

          for (const stem of _stemAnswer) {
            const point = stem.querySelector('span:first-child')?.getAttribute('data') || ''
            const text = stem.querySelector('div:last-child')?.textContent
            _schema[point] = text
          }

          _returns.push(_schema)
        }

        break
      }

      case '阅读理解': {
        for (const q of root!.querySelectorAll('div.readComprehensionQues > div')) {
          const _schema = structuredClone(schema)

          _schema.材料 = root!.querySelector('h3:first-child')?.textContent.trim()

          const _stemAnswer = q.querySelectorAll('div.stem_answer > div') || []

          _schema.Title = q.querySelector('div.reader_answer_tit')?.textContent.trim()
          _schema.选项数 = _stemAnswer.length
          _schema.练习ID = (root?.getAttribute('data') || '') + '+' + q.getAttribute('data')

          for (const stem of _stemAnswer) {
            const point = stem.querySelector('span:first-child')?.getAttribute('data') || ''
            const text = stem.querySelector('div:last-child')?.textContent
            _schema[point] = text
          }

          _returns.push(_schema)
        }

        break
      }

      default: {
        throwError('Unsupported question type to convert', {html, params})
      }
    }

    for (const _return of _returns) {
      if (_return.RightKey || _return.Analyze) continue

      const _chunk = await deepseek.ANSWER_PMPT.invoke({
        question: lodash
          .filter([
            _return.材料 ? `材料: ${_return.材料}` : '',
            `问题: ${_return.Title}`,
            _return.A ? `A. ${_return.A}` : '',
            _return.B ? `B. ${_return.B}` : '',
            _return.C ? `C. ${_return.C}` : '',
            _return.D ? `D. ${_return.D}` : '',
            _return.E ? `E. ${_return.E}` : '',
            _return.F ? `F. ${_return.F}` : '',
            _return.G ? `G. ${_return.G}` : '',
            _return.H ? `H. ${_return.H}` : '',
          ])
          .join('\n'),
      })

      const _chunkParts = parse(_chunk.content as string)

      _return.Analyze = _chunkParts.querySelector('analyze')?.textContent.trim() || ''
      _return.RightKey = _chunkParts.querySelector('answer')?.textContent.trim() || ''
    }

    return _returns
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    if (!params.bank.meta?.courseUrl) {
      return []
    }

    // to course page.
    const courseView = await axios.get(
      params.bank.meta.courseUrl,
      lodash.merge({}, config, {
        maxRedirects: 0,
        params: {
          catalogId: 0,
          size: 500,
          start: 0,
          superstarClass: 0,
          v: Date.now(),
        },
      } as AxiosRequestConfig),
    )

    const root = parse(courseView.data)

    const workEnc = root.querySelector('input#workEnc')?.getAttribute('value')

    // to work view.
    const page = await puppeteer.page(
      'chaoxing',
      'https://mooc1.chaoxing.com/mooc2/work/list?' +
        `classId=${params.bank.meta.clazzId}&courseId=${params.bank.meta.courseId}&enc=${workEnc}&ut=s`,
    )

    const lis = await page.$$('div.has-content ul > li')

    const categories = [] as Category[]

    for (const li of lis) {
      // attribute data
      const url = await li.evaluate((el) => el.getAttribute('data') as string)
      const name = await li.evaluate((el) => el.querySelector('div.right-content > p.overHidden2.fl')?.textContent)
      const status = await li.evaluate((el) => el.querySelector('div.right-content > p.status.fl')?.textContent)

      if (status === '未开始') continue

      const questions = await (
        await puppeteer.page('chaoxing', url, config)
      ).$$eval('div[id^="question"]', (divs) => divs.map((div) => div.outerHTML))

      const urlParams = new URLSearchParams(url)

      categories.push({
        children: [],
        count: Number(questions.length),
        id: md5(urlParams.get('workId') ?? ''),
        meta: {questions, url},
        name: name ?? '',
        order: categories.length,
      })
    }

    return categories
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: md5('0'), name: '默认'}]
  }
}
