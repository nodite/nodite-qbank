import path from 'node:path'

import excel2Json from '@boterop/convert-excel-to-json'
import {Document} from '@langchain/core/documents'
import type {CacheRequestConfig} from 'axios-cache-interceptor'
import fs from 'fs-extra'
import {glob} from 'glob'
import lodash from 'lodash'
import md5 from 'md5'
import sleep from 'sleep-promise'

import {Bank} from '../../../@types/bank.js'
import {Category} from '../../../@types/category.js'
import {FetchOptions, LoginOptions} from '../../../@types/common.js'
import {Sheet} from '../../../@types/sheet.js'
import Service, {service as embeddingService} from '../../../embedding/service.js'
import {PKG_ASSETS_DIR} from '../../../env.js'
import {emitter} from '../../../utils/event.js'
import {throwError} from '../../../utils/index.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import Markji from '../../output/chaoxing/markji.js'
import {OutputClass} from '../../output/common.js'
import {Vendor} from '../common.js'
import ChaoXingExam from './chaoxing-exam.js'

export default class ChaoXingAssets extends ChaoXingExam {
  public static META = {key: path.parse(import.meta.url).name, name: '超星资料'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    await this.training(params)

    // questions.
    const factory = await embeddingService.factory()

    const docs = await factory.search(
      'chaoxing',
      [
        `bank: ${params.bank.name}`,
        `category: ${params.category.name}`,
        `sheet: ${params.sheet.name}`,
        `一级目录: ${params.bank.name}`,
        `二级目录: ${params.category.name}`,
        `三级目录: ${params.sheet.name}`,
      ].join('\n'),
    )

    const questions = lodash
      .chain(docs)
      .map(([doc]) => doc.metadata.questions)
      .flatten()
      .slice(0, params.sheet.count)
      .value()

    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const orgQKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      orgQKeys.length = 0
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)

    for (const _question of questions) {
      const _qId = String(_question['练习ID'])

      const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
        ...cacheKeyParams,
        questionId: _qId,
      })

      if (orgQKeys.includes(_qCacheKey)) continue

      await cacheClient.set(_qCacheKey, _question)
      orgQKeys.push(_qCacheKey)
      emitter.emit('questions.fetch.count', orgQKeys.length)
    }

    emitter.emit('questions.fetch.count', orgQKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new ChaoXingExam(this.getUsername()).login(options)
  }

  protected async training(params: {bank: Bank; category: Category; sheet: Sheet}): Promise<void> {
    const filepaths = lodash.filter(
      await glob(path.join(PKG_ASSETS_DIR, 'chaoxing', params.bank.name, '*.xls')),
      (file) => {
        if (params.category.name.includes('章节练习')) {
          return file.includes('章节练习')
        }

        return file.includes(params.category.name) && file.includes(params.sheet.name)
      },
    )

    const docs = [] as Document[]

    for (const filepath of filepaths) {
      docs.push(
        ...(lodash
          .chain(
            excel2Json({
              columnToKey: {'*': '{{columnHeader}}'},
              header: {rows: 1},
              source: await fs.readFile(filepath),
            }).Sheet0,
          )
          .map((q) => {
            return lodash.mapKeys(q, (v, k: string) => {
              if (k === 'ExerId') return '练习ID'
              if (k === 'CourseId') return '课程ID'
              if (k === 'CatId') return '目录ID'
              if (k === 'OptNum') return '选项数'
              return k
            })
          })
          .groupBy('目录ID')
          .map((questions, dirId: string): Document | undefined => {
            let pageContent: string = [
              `bank: ${params.bank.name}`,
              `category: ${params.category.name}`,
              `sheet: ${params.sheet.name}`,
              `一级目录: ${params.bank.name}`,
              `二级目录: ${params.category.name}`,
              `三级目录: ${params.sheet.name}`,
            ].join('\n')

            if (Number(dirId) > 0) {
              const thatIs = lodash
                .chain(questions)
                .map((q) => [
                  q['一级目录'].replaceAll(' ', ''),
                  q['二级目录'].replaceAll(' ', ''),
                  (q['三级目录'] || '根目录').replaceAll(' ', ''),
                ])
                .flatten()
                .uniq()
                .intersection([
                  (params.bank.orgName || params.bank.name).replaceAll(' ', ''),
                  (params.category.orgName || params.category.name).replaceAll(' ', ''),
                  (params.sheet.orgName || params.sheet.name).replaceAll(' ', ''),
                ])
                .value()

              if (thatIs.length === 0) {
                return
              }

              pageContent = [
                `bank: ${params.bank.name}`,
                `category: ${params.category.name}`,
                `sheet: ${params.sheet.name}`,
                `一级目录: ${questions[0]['一级目录']}`,
                `二级目录: ${questions[0]['二级目录']}`,
                `三级目录: ${questions[0]['三级目录']}`,
              ].join('\n')
            }

            return new Document({
              metadata: {
                questions,
                [Service.QUERY_ID]: md5(pageContent),
              },
              pageContent,
            })
          })
          .filter(Boolean)
          .value() as Document[]),
      )
    }

    const qCount = lodash
      .chain(docs)
      .map((doc) => doc.metadata.questions.length)
      .sum()
      .value()

    if (qCount < params.sheet.count) {
      lodash.set(params, 'vendor', this)
      throwError('Questions count is less than expected.', {params, qCount})
    }

    await embeddingService.addQuery('chaoxing', docs)
  }
}
