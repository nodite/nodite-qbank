import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {emitter} from '../../utils/event.js'
import {safeName, throwError} from '../../utils/index.js'
import fenbi from '../../utils/vendor/fenbi.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../cache-pattern.js'
import {OutputClass} from '../output/common.js'
import Markji from '../output/fenbi/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from './common.js'

export default class FenbiKaoyan extends Vendor {
  public static META = {key: 'fenbi-kaoyan', name: '粉笔考研'}

  /**
   * Allowed outputs.
   */
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

    const response = await axios.get(
      'https://schoolapi.fenbi.com/kaoyan/iphone/kaoyan/selected_quiz_list',
      requestConfig,
    )

    if (response.data.length === 0) {
      throw new Error('请前往 <粉笔考研> App 加入题库: 练习 > 右上角+号')
    }

    const _convert = async (bank: Record<string, unknown>) => ({
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
      name: await safeName(
        lodash
          .filter([
            lodash.get(bank, 'courseSet.name', ''),
            lodash.get(bank, 'course.name', ''),
            lodash.get(bank, 'quiz.name', ''),
          ])
          .join(' > '),
      ),
    })

    return Promise.all(lodash.map(response.data, _convert))
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const bankPrefix = lodash.filter(params.bank.key.split('|')).pop() as string
    const requestConfig = await this.login()

    const response = await axios.get(
      `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/categories`,
      lodash.merge({}, requestConfig, {params: {deep: true, level: 0}}),
    )

    const _convert = async (category: Record<string, unknown>): Promise<Category> => ({
      children: await Promise.all(lodash.map(category.children ?? [], _convert)),
      count: category.count as number,
      id: String(category.id),
      name: await safeName(String(category.name)),
    })

    return Promise.all(lodash.map(response.data, _convert))
  }

  /**
   * Origin questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    if (params.sheet.id === '*') throw new Error('Sheet ID is required.')

    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()
    const bankPrefix = lodash.filter(params.bank.key.split('|')).pop() as string

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const exerciseCacheKeyParams = {
      ...cacheKeyParams,
      processScope: 'exercise',
    }

    // check.
    const exerciseIds = lodash.map(
      await cacheClient.keys(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: '*'}),
      ),
      (key) => key.split(':').pop() as string,
    )

    const questionIds = lodash.map(
      await cacheClient.keys(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
      (key) => key.split(':').pop() as string,
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      questionIds.length = 0
    }

    // fetch.
    let _prevCount = questionIds.length
    let _times = 0

    emitter.emit('questions.fetch.count', questionIds.length)

    while ((questionIds.length < params.sheet.count || exerciseIds.length > 0) && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', questionIds.length)

      // exercise processing.
      let _exerciseId
      let _questionIds

      // existing exercise.
      if (exerciseIds.length > 0) {
        _exerciseId = exerciseIds.shift()
        _questionIds = await cacheClient.get(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
        )
      }
      // new exercise.
      else {
        const exerciseResponse = await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/exercises`,
          {keypointId: params.sheet.id === '0' ? params.category.id : params.sheet.id, limit: 100, type: 151},
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )

        _exerciseId = lodash.get(exerciseResponse.data, 'id', 0)
        _questionIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
          _questionIds,
        )
      }

      // check.
      if (lodash.isUndefined(_questionIds)) {
        throwError(
          'Fetch questions failed.',
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
        )
      }

      // questions processing.
      const questionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/universal/questions`,
        lodash.merge({}, requestConfig, {params: {questionIds: _questionIds.join(',')}}),
      )

      const solutionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/pure/solutions`,
        lodash.merge({}, requestConfig, {params: {ids: _questionIds.join(',')}}),
      )

      const _questions: Record<string, unknown>[] = lodash.get(questionsResponse.data, 'questions', [])
      const _materials: Record<string, unknown>[] = lodash.get(questionsResponse.data, 'materials', [])
      const _solutions: Record<string, unknown>[] = solutionsResponse.data

      for (const [_questionIdx, _question] of _questions.entries()) {
        const _questionId = String(_question.id)

        _question.solution = lodash.find(_solutions, (solution) => String(solution.id) === _questionId)
        _question.materials = lodash.map(_question.materialIndexes || [], (materialIndex) => _materials[materialIndex])

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: _questionId}),
          _question,
        )

        // answer.
        if (!String(_exerciseId).startsWith('_')) {
          const elapsedTime = random({integer: true, max: 100, min: 1})

          let {correctAnswer, id: questionId} = _question

          // 101: 翻译. 102: 英语大作文. 103: 英语小作文.
          if ([101, 102, 103].includes(Number(_question.type))) {
            correctAnswer = {
              answer: lodash.get(
                lodash.find(lodash.get(_question, 'solution.solutionAccessories', []) as never, {
                  label: 'reference',
                }),
                'content',
                '',
              ),
              elapsedTime,
              type: 204,
            }
          }

          await axios.post(
            `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/async/exercises/${_exerciseId}/incr`,
            [
              {
                answer: correctAnswer,
                flag: 0,
                questionId,
                questionIndex: _questionIdx,
                time: elapsedTime,
              },
            ],
            lodash.merge({}, requestConfig, {params: {forceUpdateAnswer: 1}}),
          )
        }

        // update.
        if (!questionIds.includes(_questionId)) questionIds.push(_questionId)
        emitter.emit('questions.fetch.count', questionIds.length)

        // delay.
        await sleep(100)
      }

      // submit exercise.
      if (!String(_exerciseId).startsWith('_')) {
        await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/iphone/${bankPrefix}/async/exercises/${_exerciseId}/submit`,
          {status: 1},
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )
      }

      await cacheClient.del(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
      )

      // repeat fetch.
      _times = questionIds.length === _prevCount ? _times + 1 : 0
      _prevCount = questionIds.length
      emitter.emit('questions.fetch.times', _times)
    }

    emitter.emit('questions.fetch.count', questionIds.length)

    await sleep(1000)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    const _convert = async (child: any): Promise<Sheet> => ({
      count: child.count,
      id: child.id,
      name: await safeName(child.name),
    })

    return lodash.isEmpty(params.category.children)
      ? [{count: params.category.count, id: '0', name: '默认'}]
      : Promise.all(lodash.map(params.category.children, _convert))
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN)})
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
      'https://login.fenbi.com/iphone/users/loginV2',
      {
        app: 'web',
        password: await fenbi.encrypt(fenbi.PUBLIC_KEY, password),
        persistent: 1,
        phone: this.getUsername(),
      },
      {
        cache: false,
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
