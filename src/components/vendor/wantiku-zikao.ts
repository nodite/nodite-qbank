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
import {find} from '../../utils/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../cache-pattern.js'
import {OutputClass} from '../output/common.js'
import Skip from '../output/skip.js'
import {HashKeyScope, Vendor, hashKeyBuilder} from './common.js'

export default class WantikuZikao extends Vendor {
  public static META = {key: 'wantiku-zikao', name: '万题库自考'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
    }
  }

  /**
   * Banks.
   */
  @Cacheable({cacheKey: () => '', hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    const requestConfig = await this.login()

    // Parent subject.
    const parentSubjectsResponse = await axios.get(
      'https://api.wantiku.com/api/ExamSubject/GetAllSubjects',
      lodash.merge({}, requestConfig, {params: {time: Date.now()}}),
    )

    const parentSubjects = find(parentSubjectsResponse.data.SubjectEntities, '自考') as Record<string, any>

    const banks: Bank[] = []

    for (const parentSubject of parentSubjects.SubjectEntities) {
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

      banks.push(
        ...lodash.map(subjects, (subject) => ({
          id: [parentSubject.SubjectParentId, parentSubject.SubjectLevel, subject.SubjectId].join('|'),
          key: [parentSubject.SubjectParentId, parentSubject.SubjectLevel, subject.SubjectId].join('|'),
          name: [parentSubject.SubjectName, subject.SubjectName].join(' > '),
        })),
      )
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: (args) => args[0].id, hashKey: hashKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(bank: Bank): Promise<Category[]> {
    const requestConfig = await this.login()

    const [parentSubjectId, subjectLevel, subjectId] = bank.id.split('|')

    const response = await axios.get(
      'https://api.wantiku.com/api/BrushQuestion/RealCustomAutoSpecTree?',
      lodash.merge({}, requestConfig, {
        headers: {SubjectLevel: subjectLevel, SubjectParentID: parentSubjectId},
        params: {SubjectId: subjectId, time: Date.now()},
      }),
    )

    return lodash.map(response.data.SpecialTreeList ?? [], (ct) => ({
      children: [],
      count: ct.TotalQuestions,
      id: ct.ExamSiteId,
      name: ct.ExamSiteName,
    }))
  }

  /**
   * Fetch Questions.
   */
  public async fetchQuestions(bank: Bank, category: Category, sheet: Sheet, options?: FetchOptions): Promise<void> {
    // prepare.
    const cacheClient = this.getCacheClient()
    const requestConfig = await this.login()

    const [parentSubjectId, subjectLevel, subjectId] = bank.id.split('|')

    // cache key.
    const cacheKeyParams = {
      bankId: bank.id,
      categoryId: category.id,
      sheetId: sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const questionItemCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)(cacheKeyParams)

    const questionIds = lodash.map(
      await cacheClient.keys(questionItemCacheKey + ':*'),
      (key) => key.split(':').pop() as string,
    )

    if (options?.refetch) {
      await cacheClient.delHash(questionItemCacheKey + ':*')
      questionIds.length = 0
    }

    // fetch.
    let _prevCount = questionIds.length
    let _times = 0

    emitter.emit('questions.fetch.count', questionIds.length)

    while (questionIds.length < sheet.count && _times < 5) {
      // emit count.
      emitter.emit('questions.fetch.count', questionIds.length)

      const response = await axios.get(
        'https://api.wantiku.com/api/BrushQuestion/RealCustomPaper',
        lodash.merge({}, requestConfig, {
          headers: {
            SubjectId: subjectId,
            SubjectLevel: subjectLevel,
            SubjectParentID: parentSubjectId,
          },
          params: {
            ExamSiteId: category.id,
            SubjectId: subjectId,
            practiceTypeEnum: 0,
            questionNum: 100, // 一次请求的题目数量
            questionTypeEnum: 0,
            time: Date.now(),
          },
        }),
      )

      const _questions: any[] = response.data.PaperEntity.TKQuestionsBasicEntityList[0].QuestionsEntityList

      // cache.
      for (const [, _question] of _questions.entries()) {
        const _questionId = String(_question.RealQuestionId)

        await cacheClient.set(questionItemCacheKey + ':' + _questionId, _question)

        // update.
        if (!questionIds.includes(String(_questionId))) questionIds.push(String(_questionId))
        emitter.emit('questions.fetch.count', questionIds.length)

        // delay.
        await sleep(100)
      }

      // repeat fetch.
      _times = questionIds.length === _prevCount ? _times + 1 : 0
      _prevCount = questionIds.length
      emitter.emit('questions.fetch.times', _times)
    }

    emitter.emit('questions.fetch.count', questionIds.length)
    await sleep(1000)
    emitter.closeListener('questions.fetch.count')
  }

  public async fetchSheet(_bank: Bank, category: Category, _options?: FetchOptions): Promise<Sheet[]> {
    return [{count: category.count, id: '0', name: '默认'}]
  }

  @Cacheable({
    cacheKey: (_, context) => context.getUsername(),
    hashKey: hashKeyBuilder(HashKeyScope.LOGIN),
  })
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const response = await axios.get('https://api.wantiku.com/api/Login/LoginV2', {
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
