import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {emitter} from '../../utils/event.js'
import {reverseTemplate, throwError} from '../../utils/index.js'
import playwright from '../../utils/playwright.js'
import wx233 from '../../utils/vendor/wx233.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../cache-pattern.js'
import {OutputClass} from '../output/common.js'
import Markji from '../output/wx233/markji.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class Wx233 extends Vendor {
  public static META = {key: 'wx233', name: '233网校'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const requestConfig = await this.login()

    const sid = await wx233.sid()

    const domains = await axios.get(
      'https://japi.233.com/ess-study-api/user-course/buy-domain',
      lodash.merge({}, requestConfig, {headers: {sid, sign: await wx233.sign('', sid, 'GET')}}),
    )

    const banks = [] as Bank[]

    for (const domain of domains.data.data) {
      const params = {domain: domain.domain}

      const subjects = await axios.get(
        'https://japi.233.com/ess-tiku-api/tiku-base/do/switch-subject',
        lodash.merge({}, requestConfig, {
          headers: {sid, sign: await wx233.sign(params, sid, 'GET')},
          params,
        }),
      )

      for (const subject of subjects.data?.data?.subjectList ?? []) {
        for (const child of subject.childList) {
          banks.push({
            id: [domain.id, subject.id, child.id].join('|'),
            key: [domain.domain, subject.id, child.id].join('|'),
            name: [domain.cname, subject.cname, child.cname].join(' > '),
          })
        }
      }
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const requestConfig = await this.login()
    const subjectId = bank.id.split('|')[2]

    const sid = await wx233.sid()
    const params = {chapterType: 1, isApplet: 0, subjectId}

    const chapters = await axios.get(
      'https://japi.233.com/ess-tiku-api/front/chapter/do/init',
      lodash.merge({}, requestConfig, {
        headers: {sid, sign: await wx233.sign(params, sid, 'GET')},
        params,
      }),
    )

    const categories = [] as Category[]

    for (const chapter of chapters.data?.data?.chapterInfoFrontRspList ?? []) {
      categories.push({
        children: lodash.map(chapter.childList || [], (child) => ({
          children: [],
          count: child.questionsNum,
          id: String(child.id),
          name: child.name,
        })),
        count: chapter.questionsNum,
        id: String(chapter.id),
        name: chapter.name,
      })
    }

    return categories
  }

  /**
   * Fetch Questions.
   */
  public async fetchQuestions(bank: Bank, category: Category, sheet: Sheet, options?: FetchOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()
    const domainKey = bank.key.split('|')[0]
    const objectId = sheet.id === '0' ? category.id : sheet.id
    const subjectId = bank.id.split('|')[2]

    const sid = await wx233.sid()

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const exerciseCacheKeyParams = {...cacheKeyParams, processScope: 'exercise'}

    // check.
    const exerciseKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: '*'}),
    )

    const questionKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      questionKeys.length = 0
    }

    // fetch.
    let _prevCount = questionKeys.length
    let _times = 0

    emitter.emit('questions.fetch.count', questionKeys.length)

    while ((questionKeys.length < sheet.count || exerciseKeys.length > 0) && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', questionKeys.length)

      // exercise processing.
      let _exerciseId
      let _exerciseKey

      // existing exercise.
      if (exerciseKeys.length > 0) {
        _exerciseKey = exerciseKeys.shift() as string
        _exerciseId = reverseTemplate(CACHE_KEY_ORIGIN_QUESTION_PROCESSING, _exerciseKey).processId
      }
      // new exercise.
      else {
        const exerciseBody = {
          attachType: 1,
          client: 1,
          domain: domainKey,
          mode: 1,
          objectId,
          subjectId,
          type: 3,
        }

        const exerciseResponse = await axios.post(
          'https://japi.233.com/ess-tiku-api/front/extract/questions',
          exerciseBody,
          lodash.merge({}, requestConfig, {
            headers: {sid, sign: await wx233.sign(exerciseBody, sid, 'post')},
          }),
        )

        _exerciseId = lodash.get(exerciseResponse.data, 'data.ztNo', '0')
        _exerciseKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({
          ...exerciseCacheKeyParams,
          processId: _exerciseId,
        })

        await cacheClient.set(_exerciseKey, exerciseResponse.data)
      }

      if (lodash.isUndefined(_exerciseId) || _exerciseId === '0') {
        await cacheClient.del(_exerciseKey)
        throwError('Fetch exercise failed', {bank, category, sheet})
      }

      // questions processing.
      const questionsBody = {
        isCustomizedPage: 0,
        pageNo: 1,
        pageSize: 500,
        ztNo: _exerciseId,
      }

      const questionsResponse = await axios.post(
        'https://japi.233.com/ess-tiku-api/front/extract/page',
        questionsBody,
        lodash.merge({}, requestConfig, {headers: {sid, sign: await wx233.sign(questionsBody, sid, 'POST')}}),
      )

      const _questions = lodash.get(questionsResponse.data, 'data.extractQuestionDataRspList', [])

      for (const [, _question] of _questions.entries()) {
        const _questionId = String(_question.id)
        const _questionKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _questionId,
        })

        if (lodash.includes(questionKeys, _questionId)) {
          continue
        }

        await cacheClient.set(_questionKey, _question)

        questionKeys.push(_questionKey)

        emitter.emit('questions.fetch.count', questionKeys.length)

        // delay.
        await sleep(100)
      }

      await cacheClient.del(_exerciseKey)

      // repeat fetch.
      _times = questionKeys.length === _prevCount ? _times + 1 : 0
      _prevCount = questionKeys.length
      emitter.emit('questions.fetch.times', _times)
    }

    emitter.emit('questions.fetch.count', questionKeys.length)

    await sleep(1000)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(_bank: Bank, category: Category, _options?: FetchOptions): Promise<Sheet[]> {
    return lodash.isEmpty(category.children) ? [{count: category.count, id: '0', name: '默认'}] : category.children
  }

  @Cacheable({
    cacheKey: (_, context) => context.getUsername(),
    hashKey: hashKeyBuilder(HashKeyScope.LOGIN),
  })
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await playwright.page('wx233.login', 'https://passport.233.com/login')

    await page.click('a[class="login_choice common js-common"]')
    await page.fill('input[name="account"]', this.getUsername())
    await page.fill('input[name="password"]', password)
    await page.click('span[class="user_protocolCheck js-protocolCheck"]')
    await page.click('input[id="normalSubmit"]')
    await page.waitForURL('https://wx.233.com/**')

    const cookies = await page.context().cookies()

    return {
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
        Token: cookies.find((cookie) => cookie.name === 'clientauthentication')?.value,
        'User-Agent': await page.evaluate(() => window.navigator.userAgent),
      },
    }
  }
}
