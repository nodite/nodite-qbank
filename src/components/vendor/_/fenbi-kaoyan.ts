import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'
import md5 from 'md5'
import path from 'node:path'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import sqliteCache from '../../../cache/sqlite.manager.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import fenbi from '../../../utils/vendor/fenbi.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/fenbi/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class FenbiKaoyan extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔考研'}

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
    const config = await this.login()

    const response = await axios.get(this._fetchBankMeta.endpoint, config)

    if (lodash.isEmpty(lodash.get(response, this._fetchBankMeta.path))) {
      throw new Error(this._fetchBankMeta.emptyMessage)
    }

    const banks = [] as Bank[]

    for (const bank of lodash.get(response, this._fetchBankMeta.path, [])) {
      const _id = md5(
        JSON.stringify([
          lodash.get(bank, 'courseSet.id', ''),
          lodash.get(bank, 'course.id', ''),
          lodash.get(bank, 'quiz.id', ''),
        ]),
      )

      banks.push({
        id: _id,
        meta: {
          bankPrefix: lodash
            .filter([
              lodash.get(bank, 'courseSet.prefix', ''),
              lodash.get(bank, 'course.prefix', ''),
              lodash.get(bank, 'quiz.prefix', ''),
            ])
            .pop(),
          courseId: lodash.get(bank, 'course.id', ''),
          coursePrefix: lodash.get(bank, 'course.prefix', ''),
          courseSetId: lodash.get(bank, 'courseSet.id', ''),
          courseSetPrefix: lodash.get(bank, 'courseSet.prefix', ''),
          quizId: lodash.get(bank, 'quiz.id', ''),
          quizPrefix: lodash.get(bank, 'quiz.prefix', ''),
        },
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
    }

    return lodash
      .chain(banks)
      .sortBy(['key', 'id'], ['asc', 'asc'])
      .map((bank, idx) => ({...bank, order: idx}))
      .value()
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const reqConfig = await this.login()

    let bankPrefix = params.bank.meta?.bankPrefix
    const getParams = this._fetchCategoryMeta.params

    switch (bankPrefix) {
      case 'shenlun': {
        bankPrefix = 'shenlun/pdpg'

        break
      }

      case 'zhyynl': {
        bankPrefix = 'zhyynl/etRuleQuestion'

        break
      }

      case 'sydwms': {
        getParams.filter = 'giant'

        break
      }
    }

    const response = await axios.get(
      lodash.template(this._fetchCategoryMeta.endpoint)({bankPrefix}),
      lodash.merge({}, reqConfig, {params: getParams}),
    )

    const _convert = async (index: number, category: Record<string, any>): Promise<Category> => {
      const children = [] as Category[]

      for (const [_childIndex, child] of (category.children ?? []).entries()) {
        children.push(await _convert(_childIndex, child))
      }

      return {
        children,
        count: category.count as number,
        id: String(category.id),
        meta: lodash.omit(category, ['children', 'count', 'id', 'name']),
        name: await safeName(String(category.name)),
        order: index,
      }
    }

    const categories = [] as Category[]

    for (const [index, child] of response.data.entries()) {
      categories.push(await _convert(index, child))
    }

    return categories
  }

  /**
   * Origin questions.
   */
  // eslint-disable-next-line complexity
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    if (params.sheet.id === '*') throw new Error('Sheet ID is required.')

    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()
    const bankPrefix = params.bank.meta?.bankPrefix

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const exerciseCacheKeyParams = {...cacheKeyParams, processScope: 'exercise'}

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

    // customize exercises for giant questions.
    if (questionIds.length < params.sheet.count && params.sheet.meta?.giantOnly) {
      const exerciseResponse = await axios.get(
        lodash.template(this._fetchQuestionMeta.exercisesEndpoint)({bankPrefix, exerciseType: 'giants'}),
        lodash.merge({}, requestConfig, {
          params: {keypointId: params.sheet.id === '0' ? params.category.id : params.sheet.id},
        }),
      )

      for (const [_idx, _questionsIds] of lodash.chunk(exerciseResponse.data, 100).entries()) {
        const _exerciseId = `_${_idx}`

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
          _questionsIds,
        )

        exerciseIds.push(_exerciseId)
      }

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
      let _exerciseId: string
      let _questionIds: string[]

      // existing exercise.
      if (exerciseIds.length > 0) {
        _exerciseId = exerciseIds.shift() as string
        _questionIds = await cacheClient.get(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
        )
      }
      // new exercise for default.
      else {
        const exerciseResponse = await axios.post(
          lodash.template(this._fetchQuestionMeta.exercisesEndpoint)({bankPrefix, exerciseType: 'exercises'}),
          {keypointId: params.sheet.id === '0' ? params.category.id : params.sheet.id, limit: 100, type: 151},
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )

        _exerciseId = lodash.get(exerciseResponse.data, 'id', 0)
        _questionIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])
      }

      await cacheClient.set(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
        _questionIds,
      )

      // check.
      if (lodash.isUndefined(_questionIds)) {
        throwError(
          'Fetch questions failed.',
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
        )
      }

      // questions processing.
      let _questions: Record<string, unknown>[] = []
      let _materials: Record<string, unknown>[] = []
      let _solutions: Record<string, unknown>[] = []

      // giant
      if (params.sheet.meta?.giantOnly) {
        const solutionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.solutionsEndpoint)({bankPrefix, solutionType: 'universal/auth'}),
          lodash.merge({}, requestConfig, {params: {questionIds: _questionIds.join(','), type: 9}}),
        )

        _questions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
        _materials = lodash.chain(solutionsResponse).get('data.materials', []).cloneDeep().value()
        _solutions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
      }
      // default
      else {
        const questionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.questionsEndpoint)({bankPrefix}),
          lodash.merge({}, requestConfig, {params: {questionIds: _questionIds.join(',')}}),
        )

        const solutionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.solutionsEndpoint)({bankPrefix, solutionType: 'pure'}),
          lodash.merge({}, requestConfig, {params: {ids: _questionIds.join(',')}}),
        )

        _questions = lodash.get(questionsResponse.data, 'questions', [])
        _materials = lodash.get(questionsResponse.data, 'materials', [])
        _solutions = solutionsResponse.data
      }

      // go, go, go...
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

          // 101: 翻译.
          // 102: 英语大作文.
          // 103: 英语小作文.
          // 104: 公务员申论.
          if ([101, 102, 103, 104].includes(Number(_question.type))) {
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
            lodash.template(this._fetchQuestionMeta.incrEndpoint)({bankPrefix, exerciseId: _exerciseId}),
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
          lodash.template(this._fetchQuestionMeta.submitEndpoint)({bankPrefix, exerciseId: _exerciseId}),
          {status: 1},
          lodash.merge({}, requestConfig, {
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            validateStatus: () => true,
          }),
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
    if (lodash.isEmpty(params.category.children)) {
      return [{count: params.category.count, id: '0', name: '默认'}]
    }

    const sheets = [] as Sheet[]

    for (const child of params.category.children) {
      sheets.push({
        count: child.count,
        id: child.id,
        meta: child.meta,
        name: await safeName(child.name),
        order: child.order,
      })
    }

    return sheets
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
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

    const cookies = response.headers['set-cookie']?.map((cookie) => cookie.split(';')[0]).join('; ')

    return {
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookies,
        'User-Agent': userAgent,
      },
      params,
    }
  }

  /**
   * Bank meta.
   */
  protected get _fetchBankMeta(): Record<string, any> {
    return {
      emptyMessage: '请前往 <粉笔考研> App 加入题库: 练习 > 右上角+号',
      endpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/kaoyan/selected_quiz_list',
      path: 'data',
    }
  }

  /**
   * Category meta.
   */
  protected get _fetchCategoryMeta(): Record<string, any> {
    return {
      endpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/categories',
      params: {deep: true, level: 0},
    }
  }

  /**
   * Questions meta.
   */
  protected get _fetchQuestionMeta(): Record<string, any> {
    return {
      exercisesEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/exercises',
      incrEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      questionsEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/universal/questions',
      solutionsEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/pure/solutions',
      submitEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
    }
  }
}
