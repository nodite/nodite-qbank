import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import chunk from 'chunk'
import lodash from 'lodash'
import random from 'random-number'
import sleep from 'sleep-promise'
import UserAgent from 'user-agents'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {AssertString, ConvertOptions, FetchOptions} from '../../types/common.js'
import {Question, QuestionType} from '../../types/question.js'
import {Sheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {emitter} from '../../utils/event.js'
import {PUBLIC_KEY, encrypt} from '../../utils/fenbi.js'
import * as parser from '../../utils/parser.js'
import {
  CACHE_KEY_ORIGIN_QUESTION_ITEM,
  CACHE_KEY_ORIGIN_QUESTION_PROCESSING,
  CACHE_KEY_QUESTION_ITEM,
} from '../cache-pattern.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class FenbiKaoyan extends Vendor {
  public static VENDOR_NAME: string = 'fenbi-kaoyan'

  /**
   * Categories.
   */
  public async convertQuestions(bank: Bank, category: Category, sheet: Sheet, options?: ConvertOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      username: this.getUsername(),
      vendorName: (this.constructor as typeof Vendor).VENDOR_NAME,
    }

    // check origin questions.
    const originQuestionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

    const originQuestionIds = lodash.map(
      await cacheClient.keys(originQuestionItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    // check questions.
    const questionItemCacheKey = lodash.template(CACHE_KEY_QUESTION_ITEM)(cacheKeyParams)

    if (options?.reconvert) {
      await cacheClient.delHash(questionItemCacheKey + ':*')
    }

    const questionIds = lodash.map(
      await cacheClient.keys(questionItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    const diffQuestionIds = lodash.difference(originQuestionIds, questionIds)

    // convert.
    emitter.emit('questions.convert.count', questionIds.length)

    for (const _questionId of diffQuestionIds) {
      // emit.
      emitter.emit('questions.convert.count', questionIds.length)

      const _originQuestion = await cacheClient.get(originQuestionItemCacheKey + ':' + _questionId)

      const {
        accessories,
        content: _content,
        correctAnswer: _correctAnswer,
        solution: _solution,
        type: _type,
      } = _originQuestion

      // ====================
      const _questionType: QuestionType = ((_type) => {
        if (_type === 1) return 'SingleChoice'
        if (_type === 2) return 'MultiChoice'
        if (_type === 61) return 'BlankFilling'
        throw new Error('Unknown question type')
      })(_type)

      const _question = {
        content: await parser.html(_content),
        id: _questionId,
        solution: await parser.html(_solution.solution),
        type: _questionType,
      } as Question

      // ====================
      // accessories.
      const _accessories = lodash.filter(
        accessories,
        (accessory) =>
          ![1001].includes(accessory.type) ||
          // 1001: choiceTranslations
          (accessory.type === 1001 && !lodash.isEmpty(accessory.choiceTranslations)),
      )

      // multi accessories.
      if (_accessories.length === 0) {
        _question.answerAccessory = undefined
      }
      // todo: multi accessories.
      else if (_accessories.length > 1) {
        console.log(JSON.stringify(_originQuestion, null, 2))
        throw new Error('Multi accessories')
      }
      // 101: choice. 102: pure choice.
      else if (_accessories[0].type === 101 || _accessories[0].type === 102) {
        _question.answerAccessory = await Promise.all(
          lodash.map(_accessories[0].options, (option) => parser.html(option)),
        )
      }
      // unknown.
      else {
        console.log(JSON.stringify(_originQuestion, null, 2))
        throw new Error('Unknown accessories type')
      }

      // ====================
      // answer.
      // 201: choice.
      if (_correctAnswer.type === 201) {
        _question.answer = lodash.map(
          _correctAnswer.choice.split(','),
          (choice) => (_question.answerAccessory as AssertString[])[choice],
        )
      }
      // 202: blank filling.
      else if (_correctAnswer.type === 202) {
        _question.answer = await Promise.all(lodash.map(_correctAnswer.blanks, (blank) => parser.html(blank)))
      }
      // unknown.
      else {
        console.log(JSON.stringify(_originQuestion, null, 2))
        throw new Error('Unknown answer type')
      }

      // ====================
      await cacheClient.set(questionItemCacheKey + ':' + _questionId, _question)

      if (!questionIds.includes(_questionId)) questionIds.push(_questionId)

      await sleep(100)
    }

    emitter.emit('questions.convert.count', questionIds.length)

    await sleep(1000)

    emitter.closeListener('questions.convert.count')
  }

  /**
   * Banks.
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
  public async fetchQuestions(bank: Bank, category: Category, sheet: Sheet, options?: FetchOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()
    const bankPrefix = lodash.filter(bank.key.split('|')).pop() as string

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      username: this.getUsername(),
      vendorName: (this.constructor as typeof Vendor).VENDOR_NAME,
    }

    const questionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

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
      await cacheClient.keys(questionItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    // sheet.
    if (sheet.id !== '0') {
      const exerciseResponse = await axios.post(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/exercises`,
        {sheetId: sheet.id, type: 151},
        lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
      )

      const exerciseId = lodash.get(exerciseResponse.data, 'id', 0)

      await cacheClient.set(
        exerciseProcessingCacheKey + ':' + exerciseId,
        lodash.get(exerciseResponse.data, 'sheet.questionIds', []),
      )

      exerciseIds.push(exerciseId)
    }

    // refetch.
    if (options?.refetch) {
      for (const [_idx, _chunk] of chunk(questionIds, 100).entries()) {
        exerciseIds.push(`_${_idx}`)
        await cacheClient.set(exerciseProcessingCacheKey + `:_${_idx}`, _chunk)
      }

      questionIds.length = 0
    }

    // fetch.
    let _prevCount = questionIds.length
    let _times = 0

    emitter.emit('questions.fetch.count', questionIds.length)

    while ((questionIds.length < sheet.count || exerciseIds.length > 0) && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', questionIds.length)

      // exercise processing.
      let _exerciseId
      let _questionIds

      // existing exercise.
      if (exerciseIds.length > 0) {
        _exerciseId = exerciseIds.shift()
        _questionIds = await cacheClient.get(exerciseProcessingCacheKey + ':' + _exerciseId)
      }
      // new exercise.
      else {
        const exerciseResponse = await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/exercises`,
          {keypointId: category.id, limit: 100, type: 151},
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )

        _exerciseId = lodash.get(exerciseResponse.data, 'id', 0)
        _questionIds = lodash.get(exerciseResponse.data, 'sheet.questionIds', [])

        await cacheClient.set(exerciseProcessingCacheKey + ':' + _exerciseId, _questionIds)
      }

      // questions processing.
      const questionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/universal/questions`,
        lodash.merge({}, requestConfig, {params: {questionIds: _questionIds.join(',')}}),
      )

      const solutionsResponse = await axios.get(
        `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/pure/solutions`,
        lodash.merge({}, requestConfig, {params: {ids: _questionIds.join(',')}}),
      )

      const _questions: Record<string, unknown>[] = lodash.get(questionsResponse.data, 'questions', [])
      const _materials: Record<string, unknown>[] = lodash.get(questionsResponse.data, 'materials', [])
      const _solutions: Record<string, unknown>[] = solutionsResponse.data

      for (const [_questionIdx, _question] of _questions.entries()) {
        _question.solution = lodash.find(_solutions, {id: _question.id})
        _question.materials = lodash.map(_question.materialIndexes || [], (materialIndex) => _materials[materialIndex])

        await cacheClient.set(questionItemCacheKey + ':' + _question.id, _question)

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
            `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/async/exercises/${_exerciseId}/incr`,
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
        if (!questionIds.includes(String(_question.id))) questionIds.push(String(_question.id))
        emitter.emit('questions.fetch.count', questionIds.length)

        // delay.
        await sleep(100)
      }

      // submit exercise.
      if (!String(_exerciseId).startsWith('_')) {
        await axios.post(
          `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/async/exercises/${_exerciseId}/submit`,
          {status: 1},
          lodash.merge({}, requestConfig, {headers: {'Content-Type': 'application/x-www-form-urlencoded'}}),
        )
      }

      await cacheClient.del(exerciseProcessingCacheKey + ':' + _exerciseId)

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
  @Cacheable({cacheKey: (args) => `${args[0].id}:${args[1].id}`, hashKey: hashKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(bank: Bank, category: Category): Promise<Sheet[]> {
    // const bankPrefix = lodash.filter(bank.key.split('|')).pop() as string
    // const requestConfig = await this.login()

    // const moduleResponse = await axios.get(
    //   `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/course/getCustomExerciseModule/0`,
    //   requestConfig,
    // )

    // const modules = lodash.filter(moduleResponse.data.datas ?? [], {keyPointId: Number(category.id)})

    const sheets = [] as Sheet[]

    // for (const module of modules) {
    //   let page = 0
    //   let total = 0
    //   let count = 0

    //   do {
    //     const sheetResponse = await axios.get(
    //       `https://schoolapi.fenbi.com/kaoyan/api/${bankPrefix}/course/customExerciseQuestions/0`,
    //       lodash.merge({}, requestConfig, {params: {moduleId: module.id, pageSize: 100, toPage: page}}),
    //     )

    //     const sheetPage = sheetResponse.data.data.questionSheetVOPage ?? {
    //       list: [],
    //       pageInfo: {currentPage: 0, pageSize: 100, totalItem: 0, totalPage: 1},
    //     }

    //     // total.
    //     total = sheetPage.pageInfo.totalItem

    //     // count.
    //     count += sheetPage.list.length

    //     // page.
    //     page += 1

    //     // sheets.
    //     sheets.push(
    //       ...lodash.map(sheetPage.list, (sheet) => ({
    //         count: 0,
    //         id: String(sheet.sheetId),
    //         name: sheet.content,
    //       })),
    //     )
    //   } while (count < total)
    // }

    if (sheets.length === 0) sheets.push({count: category.count, id: '0', name: '默认'})

    return sheets
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
