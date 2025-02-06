/* eslint-disable max-depth */
import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import cacheManager from '../../../cache/cache.manager.js'
import memory from '../../../cache/memory.manager.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import fenbi from '../../../utils/vendor/fenbi.js'
import axios from '../../axios/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM, CACHE_KEY_ORIGIN_QUESTION_PROCESSING} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/fenbi/markji.js'
import MarkjiUpload from '../../output/markji-upload.js'
import {cacheKeyBuilder, HashKeyScope, Vendor} from '../common.js'

export default class FenbiKaoyan extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔考研'}

  /**
   * Allowed outputs.
   */
  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
      [MarkjiUpload.META.key]: MarkjiUpload,
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

    const _banks = lodash.get(response, this._fetchBankMeta.path, [])

    // quiz change.
    for (const _bank of structuredClone(_banks)) {
      const quizData = await this.changeQuiz({
        bank: {
          id: '',
          meta: {
            bankPrefix: lodash.findLast([
              lodash.get(_bank, 'courseSet.prefix', ''),
              lodash.get(_bank, 'course.prefix', ''),
              lodash.get(_bank, 'quiz.prefix', ''),
            ]),
            quizId: _bank.quiz?.id,
          },
          name: '',
        },
      })

      if (lodash.isEmpty(lodash.get(quizData, 'data.easyCourseVOS'))) continue

      lodash.remove(_banks, (_b) => lodash.isEqual(_b, _bank))

      const _courses = lodash.get(quizData, 'data.easyCourseVOS', [])

      for (const _course of _courses) {
        if (_course.prefix === _bank.courseSet.prefix) {
          _banks.push({..._bank})
        } else {
          _banks.push({..._bank, course: _course})
        }
      }

      await sleep(500)
    }

    const banks = [] as Bank[]

    // convert.
    for (const bank of _banks) {
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
          bankPrefix: lodash.findLast([
            lodash.get(bank, 'courseSet.prefix', ''),
            lodash.get(bank, 'course.prefix', ''),
            lodash.get(bank, 'quiz.prefix', ''),
          ]),
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
      .sortBy(['meta.courseSetPrefix', 'meta.coursePrefix', 'meta.quizPrefix'], ['asc', 'asc', 'asc'])
      .map((bank, idx) => ({...bank, order: idx}))
      .value()
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    await this.changeQuiz({bank: params.bank})

    const config = await this.login()

    const bankPrefix = params.bank.meta?.bankPrefix
    const getParams = this._fetchCategoryMeta.params

    if (bankPrefix === 'sydwms') {
      getParams.filter = 'giant'
    }

    let _endpoint = this._fetchCategoryMeta.endpoint

    if (bankPrefix === 'zhyynl') {
      _endpoint = this._fetchCategoryMeta.etRuleEndpoint
    } else if (bankPrefix === 'shenlun') {
      _endpoint = this._fetchCategoryMeta.pdpgEndpoint
    }

    const response = await axios.get(
      lodash.template(_endpoint)({bankPrefix}),
      lodash.merge({}, config, {params: getParams}),
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

  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    lodash.set(params, 'vendor', this)

    if (params.sheet.id === '*') throw new Error('Sheet ID is required.')

    // prepare.
    const cacheClient = this.getCacheClient()
    const config = await this.login()
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
    const [exerciseKeys, questionKeys] = await Promise.all([
      cacheClient.keys(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: '*'}),
      ),
      cacheClient.keys(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'})),
    ])

    const exerIds = lodash.map(exerciseKeys, (key) => key.split(':').pop() as string)

    const doneQIds = lodash.map(questionKeys, (key) => key.split(':').pop() as string)

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      doneQIds.length = 0
    }

    // ###########################################
    // customize exercises.
    //
    if (
      doneQIds.length < params.sheet.count &&
      // giant questions.
      params.sheet.meta?.giantOnly
    ) {
      const exerciseResponse = await axios.get(
        lodash.template(this._fetchQuestionMeta.giantsEndpoint)({bankPrefix}),
        lodash.merge({}, config, {
          params: {keypointId: params.sheet.id === '0' ? params.category.id : params.sheet.id},
        }),
      )

      for (const [_idx, _questionsIds] of lodash.chunk(exerciseResponse.data, 100).entries()) {
        const _exerciseId = `_${_idx}`

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerciseId}),
          _questionsIds,
        )

        exerIds.push(_exerciseId)
      }

      doneQIds.length = 0
    }
    //
    // ###########################################

    // fetch.
    let _prevCount = doneQIds.length
    let _times = 0

    emitter.emit('questions.fetch.count', doneQIds.length)

    while ((doneQIds.length < params.sheet.count || exerIds.length > 0) && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', doneQIds.length)

      // exercise processing.
      let _exerId: string
      let _qIds: string[]

      // zhyynl.
      if (bankPrefix === 'zhyynl') {
        const zhyynls: any = (await memory.cache.get('zhyynls')) || params.sheet.meta?.zhyynl || []

        if (zhyynls.length === 0) {
          _times = 5
          continue
        }

        do {
          const zhyynl = zhyynls.shift()

          if (zhyynl.exerciseId) {
            _exerId = String(zhyynl.exerciseId)
            _qIds = [String(zhyynl.questionId)]
          } else if (zhyynl.sheetId) {
            try {
              // 您创建练习的频率过高，请稍候再试
              await sleep(1000)

              const exerciseResponse = await axios.post(
                lodash.template(this._fetchQuestionMeta.exercisesEndpoint)({bankPrefix}),
                undefined,
                lodash.merge({}, config, {params: {sheetId: zhyynl.sheetId, type: 26}}),
              )

              _exerId = lodash.get(exerciseResponse.data, 'id', 0)
              _qIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])
            } catch {
              _exerId = '_0'
              _qIds = [String(zhyynl.questionId)]
            }
          } else if (zhyynl.questionId) {
            _exerId = '_0'
            _qIds = [String(zhyynl.questionId)]
          } else {
            throwError('zhyynl error', {params, zhyynl})
          }

          if (lodash.without(_qIds, ...doneQIds).length > 0) break
        } while (true)

        await memory.cache.set('zhyynls', zhyynls)
      }
      // existing exercise.
      else if (exerIds.length > 0) {
        _exerId = exerIds.shift() as string
        _qIds = await cacheClient.get(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
        )
      }
      // new exercise for default.
      else {
        const exerciseResponse = await axios.post(
          lodash.template(this._fetchQuestionMeta.exercisesEndpoint)({bankPrefix}),
          {keypointId: params.sheet.id === '0' ? params.category.id : params.sheet.id, limit: 100, type: 151},
          lodash.merge({}, config, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )

        _exerId = lodash.get(exerciseResponse.data, 'id', 0)
        _qIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])
      }

      await cacheClient.set(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
        _qIds,
      )

      // check.
      if (lodash.isUndefined(_qIds)) {
        throwError('Fetch questions failed.', {
          exerciseCacheKey: lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({
            ...exerciseCacheKeyParams,
            processId: _exerId,
          }),
          params,
        })
      }

      // questions processing.
      let _questions: Record<string, unknown>[] = []
      let _materials: Record<string, unknown>[] = []
      let _solutions: Record<string, unknown>[] = []

      // giant
      if (params.sheet.meta?.giantOnly) {
        const solutionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.universalAuthSolutionsEndpoint)({
            bankPrefix,
          }),
          lodash.merge({}, config, {params: {questionIds: _qIds.join(','), type: 9}}),
        )

        _questions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
        _materials = lodash.chain(solutionsResponse).get('data.materials', []).cloneDeep().value()
        _solutions = lodash.chain(solutionsResponse).get('data.solutions', []).cloneDeep().value()
      }
      // default
      else {
        const questionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.questionsEndpoint)({bankPrefix}),
          lodash.merge({}, config, {params: {questionIds: _qIds.join(',')}}),
        )

        const solutionsResponse = await axios.get(
          lodash.template(this._fetchQuestionMeta.solutionsEndpoint)({bankPrefix}),
          lodash.merge({}, config, {params: {ids: _qIds.join(',')}}),
        )

        _questions = lodash.get(questionsResponse.data, 'questions', [])
        _materials = lodash.get(questionsResponse.data, 'materials', [])
        _solutions = solutionsResponse.data
      }

      // go, go, go...
      for (const [_qIdx, _q] of _questions.entries()) {
        const _qId = String(_q.id)

        _q.solution = lodash.find(_solutions, (solution) => String(solution.id) === _qId)
        _q.materials = lodash.map(_q.materialIndexes || [], (materialIndex) => _materials[materialIndex])

        if (lodash.some(_q.accessories as any, {label: 'relatedMaterialId'})) {
          throwError('Unknown materials.', {params, question: _q})
        }

        await cacheClient.set(
          lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: _qId}),
          _q,
        )

        // answer.
        if (!String(_exerId).startsWith('_')) {
          const elapsedTime = random({integer: true, max: 100, min: 1})

          let {correctAnswer} = _q

          if (!correctAnswer) {
            correctAnswer = {
              answer: lodash.get(
                lodash.find(lodash.get(_q, 'solution.solutionAccessories', []) as never, {
                  label: 'reference',
                }),
                'content',
                '',
              ),
              elapsedTime,
              type: 204,
            }
          }

          try {
            await axios.post(
              lodash.template(this._fetchQuestionMeta.incrEndpoint)({bankPrefix, exerciseId: _exerId}),
              [
                {
                  answer: correctAnswer,
                  flag: 0,
                  questionId: _qId,
                  questionIndex: _qIdx,
                  time: elapsedTime,
                },
              ],
              lodash.merge({}, config, {params: {forceUpdateAnswer: 1}}),
            )
          } catch {}
        }

        // update.
        if (!doneQIds.includes(_qId)) doneQIds.push(_qId)
        emitter.emit('questions.fetch.count', doneQIds.length)

        // delay.
        await sleep(100)
      }

      // submit exercise.
      if (!String(_exerId).startsWith('_')) {
        try {
          await axios.post(
            lodash.template(this._fetchQuestionMeta.submitEndpoint)({bankPrefix, exerciseId: _exerId}),
            {status: 1},
            lodash.merge({}, config, {
              headers: {'Content-Type': 'application/x-www-form-urlencoded'},
              validateStatus: () => true,
            }),
          )
        } catch {}
      }

      await cacheClient.del(
        lodash.template(CACHE_KEY_ORIGIN_QUESTION_PROCESSING)({...exerciseCacheKeyParams, processId: _exerId}),
      )

      // repeat fetch.
      _times = doneQIds.length === _prevCount ? _times + 1 : 0
      _prevCount = doneQIds.length
      emitter.emit('questions.fetch.times', _times)
    }

    emitter.emit('questions.fetch.count', doneQIds.length)

    await sleep(500)

    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Origin questions.
   */
  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}): Promise<Sheet[]> {
    if (lodash.isEmpty(params.category.children)) {
      return [{count: params.category.count, id: '0', name: '默认'}]
    }

    await this.changeQuiz({bank: params.bank})

    const config = await this.login()

    const sheets = [] as Sheet[]

    for (const child of params.category.children) {
      const _meta = child.meta || {}

      if (params.bank.meta?.bankPrefix === 'zhyynl') {
        _meta.zhyynl = []

        let _page = 0

        do {
          const _etResp = await axios.get(
            lodash.template(this._fetchQuestionMeta.etRuleQuestionsEndpoint)({
              bankPrefix: params.bank.meta.bankPrefix,
              page: _page,
              sheetId: child.id,
            }),
            lodash.merge({}, config),
          )

          for (const _etq of lodash.get(_etResp.data, 'list', [])) {
            _meta.zhyynl.push({
              exerciseId: lodash.get(_etq, 'exerciseId', 0),
              questionId: lodash.get(_etq, 'questionId', 0),
              sheetId: lodash.get(_etq, 'sheetId', 0),
            })
          }

          const _pageInfo = lodash.get(_etResp.data, 'pageInfo', {})

          if (_pageInfo.currentPage === _pageInfo.totalPage - 1) break

          _page++
        } while (true)
      }

      const _sheet = {
        count: child.count,
        id: child.id,
        meta: _meta,
        name: await safeName(child.name),
        order: child.order,
      }

      sheets.push(_sheet)
    }

    return sheets
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: cacheManager.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    const params = {
      // apcid: 1,
      app: 'kaoyan',
      av: 104,
      // av: 114,
      // client_context_id: 'fd811ca1317b90ab736ecc80429d4f95',
      // cquiz: 0,
      device_ua: userAgent,
      hav: 108,
      inhouse: 0,
      kav: 100,
      // kav: 102,
      // nt: 'WIFI',
      system: '17.5.1',
      // system: '18.0.1',
      // ua: 'iPhone13,2',
      version: '6.5.20',

      // version: '6.17.43',
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
        'set-cookie': response.headers['set-cookie'] ?? [],
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
      quizChange: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/users/quiz/{{quizId}}',
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
      materialsEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/pure/materials',
      questionsEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/universal/questions',
      solutionsEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/pure/solutions',
      submitEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
    }
  }

  /**
   * Change quiz.
   * @param params
   * @returns
   */
  protected async changeQuiz(params: {bank: Bank}): Promise<any> {
    if (!lodash.has(this._fetchBankMeta, 'quizChange')) return

    const _curr = await memory.cache.get<{data: any; hash: string}>('fenbi:current:quiz')

    const _hash = md5(JSON.stringify(params))

    if (_hash === _curr?.hash) return _curr.data

    const config = await this.login()

    const resp = await axios.put(
      lodash.template(this._fetchBankMeta.quizChange)({
        bankPrefix: params.bank.meta?.bankPrefix,
        quizId: params.bank.meta?.quizId,
      }),
      undefined,
      config,
    )

    await memory.cache.set('fenbi:current:quiz', {data: resp.data, hash: _hash})

    return resp.data
  }
}
