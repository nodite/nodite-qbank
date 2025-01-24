import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import sleep from 'sleep-promise'

import cacheManager from '../../../cache/cache.manager.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {emitter} from '../../../utils/event.js'
import {reverseTemplate, safeName, throwError} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import wx233 from '../../../utils/vendor/wx233.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/wx233/markji.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class Wx233 extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '233网校'}

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
          const _id = md5(JSON.stringify([domain.id, subject.id, child.id]))

          banks.push({
            id: _id,
            meta: {
              domainKey: domain.domain,
              subjectId: lodash.findLast([domain.id, subject.id, child.id]),
            },
            name: await safeName([domain.cname, subject.cname, child.cname].join(' > ')),
          })
        }
      }
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const requestConfig = await this.login()

    const sid = await wx233.sid()
    const reqParams = {chapterType: 1, isApplet: 0, subjectId: params.bank.meta?.subjectId}

    const chapters = await axios.get(
      'https://japi.233.com/ess-tiku-api/front/chapter/do/init',
      lodash.merge({}, requestConfig, {
        headers: {sid, sign: await wx233.sign(reqParams, sid, 'GET')},
        params: reqParams,
      }),
    )

    const categories = [] as Category[]

    for (const chapter of chapters.data?.data?.chapterInfoFrontRspList ?? []) {
      const children = [] as Category[]

      for (const child of chapter?.childList ?? []) {
        children.push({
          children: [],
          count: child.questionsNum,
          id: String(child.id),
          name: await safeName(child.name),
          order: child.sort,
        })
      }

      categories.push({
        children,
        count: chapter.questionsNum,
        id: String(chapter.id),
        name: await safeName(chapter.name),
        order: chapter.sort,
      })
    }

    return categories
  }

  /**
   * Fetch Questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const config = await this.login()
    const objectId = params.sheet.id === '0' ? params.category.id : params.sheet.id
    let sid

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
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

    while ((questionKeys.length < params.sheet.count || exerciseKeys.length > 0) && _times < 5) {
      sid = sid || (await wx233.sid())

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
          domain: params.bank.meta?.domainKey,
          mode: 1,
          objectId,
          subjectId: params.bank.meta?.subjectId,
          type: 3,
        }

        const exerciseResponse = await axios.post(
          'https://japi.233.com/ess-tiku-api/front/extract/questions',
          exerciseBody,
          lodash.merge({}, config, {
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
        throwError('Fetch exercise failed', {params})
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
        lodash.merge({}, config, {headers: {sid, sign: await wx233.sign(questionsBody, sid, 'POST')}}),
      )

      const _questions: any[] = lodash.get(questionsResponse.data, 'data.extractQuestionDataRspList', [])

      // child questions.
      for (const [_questionIdx, _question] of _questions.entries()) {
        _question.material = _question.material || ''

        if (lodash.isEmpty(_question.childQuestionData)) continue

        for (const _childQuestion of _question.childQuestionData) {
          _childQuestion.material = _childQuestion.material || _question.material || ''
        }

        _questions.splice(_questionIdx + 1, 0, ..._question.childQuestionData)
      }

      // save questions.
      for (const [, _question] of _questions.entries()) {
        const _questionId = String(_question.id)
        const _questionKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _questionId,
        })

        if (lodash.includes(questionKeys, _questionKey)) continue

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

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return lodash.isEmpty(params.category.children)
      ? [{count: params.category.count, id: '0', name: '默认'}]
      : lodash.map(params.category.children, (item) => ({
          count: item.count,
          id: item.id,
          name: item.name,
          order: item.order,
        }))
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await puppeteer.page('wx233', 'https://passport.233.com/login')

    await page.click('a[class="login_choice common js-common"]')
    await page.type('input[name="account"]', this.getUsername())
    await page.type('input[name="password"]', password)
    await page.click('span[class="user_protocolCheck js-protocolCheck"]')
    await Promise.all([page.waitForNavigation(), page.click('input[id="normalSubmit"]')])

    const cookies = await page.cookies()

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
