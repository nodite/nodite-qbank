import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import path from 'node:path'
import sleep from 'sleep-promise'

import sqliteCache from '../../../cache/sqlite.manager.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {emitter} from '../../../utils/event.js'
import {fiindAll, safeName} from '../../../utils/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/wantiku/markji.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class Wantiku extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '万题库·真题'}

  URL_CATEGORY = 'https://api.wantiku.com/api/BrushQuestion/RealCustomAutoSpecTree'

  URL_QUESTION = 'https://api.wantiku.com/api/BrushQuestion/RealCustomPaper'

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

    // Parent subject.
    const parentSubjectsResponse = await axios.get(
      'https://api.wantiku.com/api/ExamSubject/GetAllSubjects',
      lodash.merge({}, requestConfig, {params: {time: Date.now()}}),
    )

    const groups = fiindAll(parentSubjectsResponse.data.SubjectEntities, ['自考类', '成考类'], {
      fuzzy: true,
    }) as Record<string, any>[]

    const banks: Bank[] = []

    for (const group of groups) {
      for (const parentSubject of group.SubjectEntities) {
        const subjectsResponse = await axios.get(
          'https://api.wantiku.com/api/User/UserSubjectNew',
          lodash.merge({}, requestConfig, {
            headers: {SubjectLevel: 1, SubjectParentID: parentSubject.SubjectParentId},
            params: {SubjectLevel: parentSubject.SubjectLevel, time: Date.now()},
          }),
        )

        const subjects = lodash.filter(subjectsResponse.data.SubjectEntities ?? [], (subject) =>
          Boolean(subject.IsSelect),
        )

        if (subjects.length === 0) {
          throw new Error('请前往 <万题库> App 加入题库: 发现 > 头像 > 设置 > 考试科目管理')
        }

        for (const subject of subjects) {
          const _id = md5(
            JSON.stringify([parentSubject.SubjectParentId, parentSubject.SubjectLevel, subject.SubjectId]),
          )

          banks.push({
            id: _id,
            meta: {
              groupId: group.GroupId,
              parentSubjectId: parentSubject.SubjectParentId,
              subjectId: subject.SubjectId,
              subjectLevel: parentSubject.SubjectLevel,
            },
            name: await safeName([group.GroupName, parentSubject.SubjectName, subject.SubjectName].join(' > ')),
          })
        }
      }
    }

    return lodash
      .chain(banks)
      .sortBy(
        ['meta.groupId', 'meta.parentSubjectId', 'meta.subjectLevel', 'meta.subjectId'],
        ['asc', 'asc', 'asc', 'asc'],
      )
      .map((bank, idx) => ({...bank, order: idx}))
      .value()
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const requestConfig = await this.login()

    const response = await axios.get(
      this.URL_CATEGORY,
      lodash.merge({}, requestConfig, {
        headers: {SubjectLevel: params.bank.meta?.subjectLevel, SubjectParentID: params.bank.meta?.parentSubjectId},
        params: {SubjectId: params.bank.meta?.subjectId, time: Date.now()},
      }),
    )

    const categories = [] as Category[]

    for (const ct of response.data.SpecialTreeList ?? []) {
      categories.push({
        children: [],
        count: ct.TotalQuestions,
        id: ct.ExamSiteId,
        name: await safeName(ct.ExamSiteName),
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
    const requestConfig = await this.login()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const questionKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      questionKeys.length = 0
    }

    // fetch.
    let _prevCount = questionKeys.length
    let _times = 0

    emitter.emit('questions.fetch.count', questionKeys.length)

    while (questionKeys.length < params.sheet.count && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', questionKeys.length)

      const response = await axios.get(
        this.URL_QUESTION,
        lodash.merge({}, requestConfig, {
          headers: {
            SubjectId: params.bank.meta?.subjectId,
            SubjectLevel: params.bank.meta?.subjectLevel,
            SubjectParentID: params.bank.meta?.parentSubjectId,
          },
          params: {
            ExamSiteId: params.category.id,
            SubjectId: params.bank.meta?.subjectId,
            practiceTypeEnum: 0,
            questionNum: 100, // 一次请求的题目数量
            questionTypeEnum: 10,
            time: Date.now(),
          },
        }),
      )

      const _contexts = response.data.PaperEntity.TKContextQuestionsEntityList
      const _questions: any[] = response.data.PaperEntity.TKQuestionsBasicEntityList[0].QuestionsEntityList

      // cache.
      for (const [, _question] of _questions.entries()) {
        const _questionId = String(_question.RealQuestionId)

        const _questionKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
          ...cacheKeyParams,
          questionId: _questionId,
        })

        if (questionKeys.includes(_questionKey)) continue

        _question.TKContextQuestionsEntityList = lodash
          .chain(_contexts)
          .filter((context) => context.ContextId === _question.ContextQuestionId)
          .orderBy(['OrderNum'], ['asc'])
          .value()

        await cacheClient.set(_questionKey, _question)

        // update.
        questionKeys.push(_questionKey)
        emitter.emit('questions.fetch.count', questionKeys.length)

        // delay.
        await sleep(100)
      }

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
   * Fetch Sheet.
   */
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: params.category.count, id: '0', name: '默认'}]
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const response = await axios.get('https://api.wantiku.com/api/Login/LoginV2', {
      cache: false,
      headers: {
        'User-Agent': 'wantiku/5.6.5 (iPhone; iOS 17.5.1; Scale/3.00)',
      },
      params: {
        Password: password,
        UserName: this.getUsername(),
        time: Date.now(),
      },
    })

    return {
      headers: {
        Token: response.data.Token,
        UserID: response.data.UserID,
        VersionNumber: 565,
      },
      params: {
        UserId: response.data.UserID,
      },
    }
  }
}
