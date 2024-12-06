import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Document} from '@langchain/core/documents'
import {Cacheable} from '@type-cacheable/core'
import fs from 'fs-extra'
import lodash from 'lodash'
import md5 from 'md5'
import path from 'node:path'
import sleep from 'sleep-promise'

import sqliteCache from '../../../cache/sqlite.manager.js'
import Service, {service as embeddingService} from '../../../embedding/service.js'
import {PKG_ASSETS_DIR} from '../../../env.js'
import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import axios from '../../../utils/axios.js'
import {emitter} from '../../../utils/event.js'
import {safeName, throwError} from '../../../utils/index.js'
import puppeteer from '../../../utils/puppeteer.js'
import {CACHE_KEY_ORIGIN_QUESTION_ITEM} from '../../cache-pattern.js'
import Markji from '../../output/chaoxing/markji.js'
import {OutputClass} from '../../output/common.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from '../common.js'

export default class ChaoXing extends Vendor {
  public static META = {key: path.parse(import.meta.url).name, name: '超星'}

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

    const courses = await axios.get('https://mooc1-api.chaoxing.com/mycourse/backclazzdata', requestConfig)

    const banks = [] as Bank[]

    for (const channel of courses.data.channelList) {
      for (const course of channel?.content.course.data ?? []) {
        const person = await axios.get(
          'https://mooc1-api.chaoxing.com/gas/clazzperson',
          lodash.merge({}, requestConfig, {
            params: {
              clazzid: channel.content.id,
              courseid: course.id,
              fields: 'clazzid,clazzname,personid,createtime,popupagreement',
            },
          }),
        )

        // const count = await axios.get(
        //   'https://mooc1-api.chaoxing.com/mooc-ans/mooc2/exam/exam-question-count',
        //   lodash.merge({}, requestConfig, {
        //     params: {
        //       classId: channel.content.id,
        //       courseId: course.id,
        //       cpi: person.data.data[0].personid,
        //       createType: 0,
        //       doNoRepeat: false,
        //     },
        //   }),
        // )

        const _id = md5(JSON.stringify([person.data.data[0].personid, channel.content.id, course.id]))

        banks.push({
          // count: count.data.count || 0,
          id: _id,
          meta: {clazzId: channel.content.id, courseId: course.id, personId: person.data.data[0].personid},
          name: [course.teacherfactor, course.name].join(' > '),
        })
      }
    }

    return banks
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    // prepare embedding.
    const collectionName = `chaoxing_${params.bank.id.slice(0, 8)}_categories`
    const data = await this.getData(params)

    const docChunks = lodash
      .chain(data)
      .map('目录ID')
      .uniq()
      .map((id): Document => {
        const item = lodash.find(data, {目录ID: id})
        return {
          metadata: {
            [Service.QUERY_ID]: id,
            dirId: item['目录ID'],
            dirname: [item['一级目录'], item['二级目录'], item['三级目录']],
            exerIds: lodash.chain(data).filter({目录ID: id}).map('练习ID').value(),
          },
          pageContent: [item['一级目录'], item['二级目录'], item['三级目录']].join(' > '),
        }
      })
      .chunk(100)
      .value()

    await Promise.all(lodash.map(docChunks, (_chk) => embeddingService.addQuery(collectionName, _chk)))

    // fetch categories.
    const config = await this.login()

    const clazz = await axios.get(
      'https://mooc1-api.chaoxing.com/gas/clazz',
      lodash.merge({}, config, {
        params: {
          fields:
            'id,bbsid,hideclazz,classscore,isstart,' +
            'forbidintoclazz,allowdownload,chatid,' +
            'name,state,isfiled,information,visiblescore,' +
            'begindate,coursesetting.fields(id,courseid,hiddencoursecover,coursefacecheck),' +
            'course.fields(id,belongschoolid,name,infocontent,objectid,' +
            'app,bulletformat,mappingcourseid,imageurl,' +
            'knowledge.fields(id,name,indexOrder,parentnodeid,status,' +
            'layer,label,jobcount,isReview,begintime,endtime,' +
            'attachment.fields(id,type,objectid,extension).type(video)))',
          id: params.bank.meta?.clazzId,
          personid: params.bank.meta?.personId,
        },
      }),
    )

    const categories = [] as Category[]

    const _tree = async (knowledges: any[], parentnodeid: number): Promise<Category[]> => {
      const _store = [] as Category[]

      for (const [idx, knowledge] of lodash.filter(knowledges, {parentnodeid}).entries()) {
        const children = await _tree(knowledges, knowledge.id)

        const childrenExerIds = lodash.chain(children).map('meta.exerIds').flatten().uniq().value()

        // search extra exerIds.
        const _factory = await embeddingService.factory()
        const _segments = _factory.split2Segments(knowledge.name, 10, 20)

        const searches = lodash
          .chain(
            await Promise.all(
              lodash.map(_segments, (segment) =>
                _factory.search(collectionName, segment, {k: 100, scoreThreshold: 0.65}),
              ),
            ),
          )
          .flatten()
          // .groupBy(([_doc, _score]) => _doc.metadata.dirId)
          .value()

        const extraExerIds = lodash
          .chain(searches)
          .map(([doc]) => doc.metadata.exerIds)
          .flatten()
          .difference(childrenExerIds)
          .uniq()
          .value()

        if (!lodash.isEmpty(children) && !lodash.isEmpty(extraExerIds)) {
          children.push({
            children: [],
            count: extraExerIds.length,
            id: 'others',
            meta: {exerIds: extraExerIds},
            name: '其他',
            order: children.length,
          })
        }

        const totalExerIds = lodash.uniq([...childrenExerIds, ...extraExerIds])

        _store.push({
          children,
          count: totalExerIds.length,
          id: String(knowledge.id),
          meta: {exerIds: totalExerIds, searches: lodash.map(searches, ([doc]) => doc.pageContent)},
          name: await safeName(knowledge.name),
          order: idx,
        })
      }

      return _store
    }

    for (const clz of clazz.data.data) {
      for (const course of clz.course.data) {
        const knowledges = course.knowledge?.data ?? []
        categories.push(...(await _tree(knowledges, 0)))
      }
    }

    // others.
    const extraExerIds = lodash
      .chain(data)
      .map('练习ID')
      .difference(...lodash.map(categories, 'meta.exerIds'))
      .uniq()
      .value()

    if (!lodash.isEmpty(extraExerIds)) {
      categories.push({
        children: [],
        count: extraExerIds.length,
        id: 'others',
        meta: {exerIds: extraExerIds},
        name: '其他',
        order: categories.length,
      })
    }

    return categories
  }

  /**
   * Fetch questions.
   */
  public async fetchQuestions(
    params: {bank: Bank; category: Category; sheet: Sheet},
    options?: FetchOptions,
  ): Promise<void> {
    const cacheClient = this.getCacheClient()

    // cache key.
    const cacheKeyParams = {
      bankId: params.bank.id,
      categoryId: params.category.id,
      sheetId: params.sheet.id,
      vendorKey: (this.constructor as typeof Vendor).META.key,
    }

    const originQuestionKeys = await cacheClient.keys(
      lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}),
    )

    // refetch.
    if (options?.refetch) {
      await cacheClient.delHash(lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({...cacheKeyParams, questionId: '*'}))
      originQuestionKeys.length = 0
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)

    const data = await this.getData({bank: params.bank})

    for (const id of params.sheet.meta?.exerIds ?? []) {
      const _qId = String(id)

      const _qCacheKey = lodash.template(CACHE_KEY_ORIGIN_QUESTION_ITEM)({
        ...cacheKeyParams,
        questionId: _qId,
      })

      if (originQuestionKeys.includes(_qCacheKey)) continue

      const _question = lodash.find(data, {练习ID: id})

      if (!_question) {
        throwError('Question not found.', {id, params})
      }

      await cacheClient.set(_qCacheKey, lodash.find(data, {练习ID: id}))
      originQuestionKeys.push(_qCacheKey)
      emitter.emit('questions.fetch.count', originQuestionKeys.length)
    }

    emitter.emit('questions.fetch.count', originQuestionKeys.length)
    await sleep(500)
    emitter.closeListener('questions.fetch.count')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    if (lodash.isEmpty(params.category.children)) {
      return [{count: params.category.count, id: '0', meta: params.category.meta, name: '默认'}]
    }

    return lodash.map(params.category.children, (category) => ({
      count: category.count,
      id: category.id,
      meta: category.meta,
      name: category.name,
      order: category.order,
    }))
  }

  /**
   * Get data.
   */
  protected async getData(params: {bank: Bank}): Promise<Record<string, any>> {
    const filedir = path.join(PKG_ASSETS_DIR, 'chaoxing', params.bank.name)

    const data = {} as Record<string, any>

    for (const file of await fs.readdir(filedir)) {
      if (!file.endsWith('.json')) continue
      lodash.merge(data, await fs.readJson(path.join(filedir, file)))
    }

    return data
  }

  /**
   * Login.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN), client: sqliteCache.CommonClient})
  protected async toLogin(password: string): Promise<CacheRequestConfig> {
    const page = await puppeteer.page('chaoxing', 'https://passport2.chaoxing.com/login')

    await page.type('input[id="phone"]', this.getUsername())
    await page.type('input[id="pwd"]', password)
    await Promise.all([page.waitForNavigation(), page.click('button[class="btn-big-blue margin-btm24"]')])

    const cookies = await page.cookies()

    const headers: Record<string, string> = {
      Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6_1 like Mac OS X) ' +
        'AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 ' +
        '(schild:b86a8e29f117868cc8ab418362ef8800) (device:iPhone13,2) ' +
        'Language/zh-Hans com.ssreader.ChaoXingStudy/ChaoXingStudy_3_6.3.2_ios_phone_202409020930_249 ' +
        '(@Kalimdor)_12169545303473290717',
    }

    for (const cookie of cookies) {
      headers[cookie.name] = cookie.value
    }

    return {
      headers,
      params: {
        userid: lodash.find(cookies, {name: 'UID'})?.value,
        view: 'json',
      },
    }
  }
}
