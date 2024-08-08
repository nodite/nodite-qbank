import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import axios from '../../utils/axios.js'
import {emitter} from '../../utils/event.js'
import {PUBLIC_KEY, encrypt} from '../../utils/fenbi.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../cache-pattern.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './main.js'

export default class FenbiKaoyan extends Vendor {
  public static VENDOR_NAME: string = 'fenbi-kaoyan'

  /**
   * Banks.
   * @returns
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const requestConfig = await this.login()

    const response = await axios.get('https://schoolapi.fenbi.com/kaoyan/api/kaoyan/selected_quiz_list', requestConfig)

    if (response.data.length === 0) {
      throw new Error('请前往 <粉笔考研> App 加入题库')
    }

    return lodash.map(response.data, (bank: unknown) => ({
      id: [
        lodash.get(bank, 'courseSet.id', ''),
        lodash.get(bank, 'course.id', ''),
        lodash.get(bank, 'quiz.id', ''),
      ].join('|'),
      key: [
        lodash.get(bank, 'courseSet.prefix', ''),
        lodash.get(bank, 'course.prefix', ''),
        lodash.get(bank, 'quiz.prefix', ''),
      ].join('|'),
      name: [
        lodash.get(bank, 'courseSet.name', ''),
        lodash.get(bank, 'course.name', ''),
        lodash.get(bank, 'quiz.name', ''),
      ].join('|'),
    }))
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const bankPrefix = lodash.filter(bank.key.split('|')).pop() as string
    const requestConfig = await this.login()

    const response = await axios.get(
      `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/categories`,
      lodash.merge({}, requestConfig, {params: {deep: true, level: 0}}),
    )

    const _convert = (category: Record<string, unknown>): Category => ({
      children: lodash.map(category.children ?? [], _convert),
      count: category.count as number,
      id: String(category.id),
      name: String(category.name),
    })

    return lodash.map(response.data, _convert)
  }

  /**
   * Origin questions.
   */
  public async fetchOriginQuestions(bank: Bank, category: Category): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()
    const bankPrefix = lodash.filter(bank.key.split('|')).pop() as string

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      scope: HashKeyScope.ORIGIN_QUESTIONS,
      username: this.getUsername(),
      vendorName: (this.constructor as typeof Vendor).VENDOR_NAME,
    }

    const questionsItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

    const exerciseProcessingCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({
      ...cacheKeyParams,
      processScope: 'exercise',
    })

    // check.
    const exerciseIds = lodash.map(
      await cacheClient.keys(exerciseProcessingCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    const questionIds = lodash.map(
      await cacheClient.keys(questionsItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    // fetch.
    emitter.emit('count', questionIds.length)

    while (questionIds.length < category.count || exerciseIds.length > 0) {
      // emit count.
      emitter.emit('count', questionIds.length)

      // cache exercise.
      let _exerciseId
      let _questionIds

      if (exerciseIds.length > 0) {
        _exerciseId = exerciseIds.shift()
        _questionIds = await cacheClient.get(exerciseProcessingCacheKey + ':' + _exerciseId)
      } else {
        const exerciseResponse = await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/exercises`,
          {
            keypointId: category.id,
            limit: 100,
            type: 151,
          },
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )

        _exerciseId = lodash.get(exerciseResponse.data, 'id', 0)
        _questionIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])
      }

      await cacheClient.set(exerciseProcessingCacheKey + ':' + _exerciseId, _questionIds)

      // cache questions.
      const questionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/universal/questions`,
        lodash.merge({}, requestConfig, {params: {questionIds: _questionIds.join(',')}}),
      )

      const solutionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/pure/solutions`,
        lodash.merge({}, requestConfig, {params: {ids: _questionIds.join(',')}}),
      )

      const _questions: Record<string, unknown>[] = lodash.get(questionsResponse.data, 'questions', [])
      const _solutions: Record<string, unknown>[] = solutionsResponse.data

      for (const [_questionIdx, _question] of _questions.entries()) {
        _question.solution = lodash.find(_solutions, {id: _question.id})

        await cacheClient.set(questionsItemCacheKey + ':' + _question.id, _question)

        // answer.
        await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/async/exercises/${_exerciseId}/incr`,
          [
            {
              answer: _question.correctAnswer,
              flag: 0,
              questionId: _question.id,
              questionIndex: _questionIdx,
              time: random({integer: true, max: 10, min: 1}),
            },
          ],
          lodash.merge({}, requestConfig, {params: {forceUpdateAnswer: 1}}),
        )

        // update.
        if (!questionIds.includes(String(_question.id))) questionIds.push(String(_question.id))
        emitter.emit('count', questionIds.length)

        // delay.
        await sleep(500)
      }

      // submit exercise.
      await axios.post(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/async/exercises/${_exerciseId}/submit`,
        {status: 1},
        lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
      )

      await cacheClient.del(exerciseProcessingCacheKey + ':' + _exerciseId)
    }

    emitter.emit('count', questionIds.length)

    await sleep(1000)

    emitter.closeListener('count')
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    const params = {
      app: 'kaoyan',
      av: 104,
      device_ua: userAgent,
      hav: 108,
      inhouse: 0,
      kav: 100,
      system: '17.5.1',
      version: '6.5.20',
    }

    const response = await axios.post(
      'https://login.fenbi.com/api/users/loginV2',
      {
        app: 'web',
        password: await encrypt(PUBLIC_KEY, password),
        persistent: 1,
        phone: this.getUsername(),
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        params,
      },
    )

    // Check if login is successful
    if (response.data.code !== 1) {
      throw new Error(response.data.msg)
    }

    return {
      headers: {
        'Content-Type': 'application/json',
        Cookie: (response.headers['set-cookie'] ?? []).join('; '),
        'User-Agent': userAgent,
      },
      params,
    }
  }
}
