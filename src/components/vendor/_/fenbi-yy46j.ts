import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {LoginOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import {ApiDelegate} from '../../../@types/vendor/fenbi.js'
import {safeName} from '../../../utils/index.js'
import axios from '../../axios/index.js'
import {cacheKeyBuilder, HashKeyScope} from '../common.js'
import FenbiKaoyan from './fenbi-kaoyan.js'
import Fenbi from './fenbi.js'

/**
 * Fenbi Kaochong.
 */
export default class FenbiYy46j extends Fenbi {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔四六级'}

  protected get apiDelegate(): ApiDelegate {
    return {
      ApiParams: {},
      CreateExerciseApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/ability/v2/exercises',
      CreatePaperExerciseApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/exercises',
      GetCategoriesApi:
        'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/ability/v2/categories' +
        '?AppCourseUrl={{bankPrefix}}&deep=true&level=0',
      GetCategoryMetaApi:
        'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/category/{{moduleId}}/meta?AppCourseUrl={{bankPrefix}}',
      GetExerciseApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/exercises/{{exerciseId}}',
      GetExerciseUnfinishedApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/ability/exercises/unfinished',
      GetLabelsApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/labels?AppCourseUrl={{bankPrefix}}',
      GetMaterialsApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/pure/materials',
      GetPaperListApi:
        'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/papers' +
        '?AppCourseUrl={{bankPrefix}}&labelId={{labelId}}&pageSize={{pageSize}}&toPage=0',
      GetQuestionsApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/universal/questions',
      GetSolutionsApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/pure/solutions',
      PostIncrEndpoint: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      PostSubmitApi: 'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
      QuestionListApi:
        'https://schoolapi.fenbi.com/tiku/iphone/{{bankPrefix}}/question-list/filter' +
        '?keypointId={{moduleId}}&pageSize=15&questionType={{moduleId}}&toPage=0&unfinished=0&year=',
    } as ApiDelegate
  }

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    const config = await new FenbiKaoyan(this.getUsername()).login(options)

    config.params = lodash.merge({}, config.params, {
      app: 'yingyu',
      version: '3.6.0',
    })

    return config
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.BANKS)})
  protected async fetchBanks(): Promise<Bank[]> {
    // const config = await this.login()

    const parents = [
      {
        id: 'yy4j',
        meta: {bankPrefix: 'yy4j'},
        name: '英语四级',
        order: 0,
      },
      {
        id: 'yy6j',
        meta: {bankPrefix: 'yy6j'},
        name: '英语六级',
        order: 1,
      },
    ] as Bank[]

    const banks = [] as Bank[]

    for (const parent of structuredClone(parents)) {
      // 碎片
      const categories = await super.fetchCategories({bank: parent})

      for (const category of categories) {
        if (category.id === md5('历年真题')) {
          banks.push({
            count: category.count,
            id: md5(JSON.stringify([parent.id, category.id])),
            meta: lodash.merge({}, parent.meta, {category}),
            name: await safeName(`${parent.name} > ${category.name}`),
            order: 100,
          })
        } else {
          banks.push({
            count: category.count,
            id: md5(JSON.stringify([parent.id, category.id])),
            meta: lodash.merge({}, parent.meta, {category}),
            name: await safeName(`${parent.name} > 碎片 > ${category.name}`),
            order: banks.length,
          })
        }
      }

      // 模块
      // const modules = await axios.get(
      //   lodash.template(this.apiDelegate.GetCategoryMetaApi)({bankPrefix: parent.id, moduleId: 0}),
      //   config,
      // )

      // for (const mdl of modules.data.children || []) {
      //   banks.push({
      //     count: mdl.count,
      //     id: md5(JSON.stringify([parent.id, mdl.id])),
      //     meta: lodash.merge({}, parent.meta, {module: mdl}),
      //     name: await safeName(`${parent.name} > 模块 > ${mdl.name}`),
      //     order: banks.length,
      //   })
      // }
    }

    return lodash
      .chain(banks)
      .orderBy(['meta.bankPrefix', 'order'], ['asc', 'asc'])
      .map((bank, idx): Bank => ({...bank, order: idx}))
      .value()
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(qbank: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()
    const bankPrefix = qbank.bank.meta?.bankPrefix

    const categories = [] as Category[]

    if (qbank.bank.meta?.module) {
      const subs = await axios.get(
        lodash.template(this.apiDelegate.GetCategoryMetaApi)({
          bankPrefix,
          moduleId: qbank.bank.meta?.module.id,
        }),
        config,
      )

      for (const sub of subs.data.children || []) {
        categories.push({
          children: [],
          count: sub.count,
          id: md5(sub.id),
          meta: sub,
          name: await safeName(sub.name),
          order: categories.length,
        })
      }
    } else if (qbank.bank.meta?.category.id === md5('历年真题')) {
      const resp = await axios.get(lodash.template(this.apiDelegate.GetLabelsApi)({bankPrefix}), config)

      for (const label of resp.data || []) {
        categories.push({
          children: [],
          count: 0,
          id: md5(label.id),
          meta: label.labelMeta || {},
          name: await safeName(label.name),
          order: categories.length,
        })
      }
    } else {
      categories.push(...(qbank.bank.meta?.category.children || []))
    }

    return categories
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(qbank: {bank: Bank; category: Category}): Promise<Sheet[]> {
    const config = await this.login()

    const bankPrefix = qbank.bank.meta?.bankPrefix

    const sheets = [] as Sheet[]

    if (qbank.bank.meta?.module) {
      const subs = await axios.get(
        lodash.template(this.apiDelegate.QuestionListApi)({
          bankPrefix,
          moduleId: qbank.category.meta?.id,
        }),
        config,
      )

      for (const sub of subs.data.datas || []) {
        sheets.push({
          // count: 1,
          count: 0,
          id: md5(JSON.stringify([sub.sheetId, sub.questionId])),
          meta: sub,
          name: await safeName(sub.content),
          order: sheets.length,
        })
      }
    } else if (qbank.bank.meta?.category.id === md5('历年真题')) {
      const resp = await axios.get(
        lodash.template(this.apiDelegate.GetPaperListApi)({
          bankPrefix,
          labelId: qbank.category.meta?.id,
          pageSize: qbank.category.meta?.paperCount,
        }),
        config,
      )

      for (const paper of resp.data.list || []) {
        sheets.push({
          count: 1,
          id: md5(paper.id),
          meta: paper,
          name: await safeName(paper.name),
          order: sheets.length,
        })
      }
    } else {
      sheets.push({
        count: qbank.category.count,
        id: md5('0'),
        name: '默认',
      })
    }

    return sheets
  }
}
