import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import lodash from 'lodash'

import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {FetchOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import axios from '../../utils/axios.js'
import {safeName} from '../../utils/index.js'
import puppeteer from '../../utils/puppeteer.js'
import {OutputClass} from '../output/common.js'
import Skip from '../output/skip.js'
import {HashKeyScope, Vendor, cacheKeyBuilder} from './common.js'

export default class ChaoXing extends Vendor {
  public static META = {key: 'chaoxing', name: '超星'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Skip.META.key]: Skip,
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

        const count = await axios.get(
          'https://mooc1-api.chaoxing.com/mooc-ans/mooc2/exam/exam-question-count',
          lodash.merge({}, requestConfig, {
            params: {
              classId: channel.content.id,
              courseId: course.id,
              cpi: person.data.data[0].personid,
              createType: 0,
              doNoRepeat: false,
            },
          }),
        )

        banks.push({
          count: count.data.count || 0,
          id: [person.data.data[0].personid, channel.content.id, course.id].join('|'),
          key: [person.data.data[0].personid, channel.content.id, course.id].join('|'),
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
    const requestConfig = await this.login()

    const [personId, clazzId] = params.bank.id.split('|')

    const clazz = await axios.get(
      'https://mooc1-api.chaoxing.com/gas/clazz',
      lodash.merge({}, requestConfig, {
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
          id: clazzId,
          personid: personId,
        },
      }),
    )

    const categories = [] as Category[]

    const _tree = async (knowledges: any[], parentnodeid: number): Promise<Category[]> => {
      const _store = [] as Category[]

      for (const [idx, knowledge] of lodash.filter(knowledges, {parentnodeid}).entries()) {
        _store.push({
          children: await _tree(knowledges, knowledge.id),
          count: 0,
          id: String(knowledge.id),
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

    return categories
  }

  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  public async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    if (lodash.isEmpty(params.category.children)) {
      return [{count: params.category.count, id: '0', name: '默认'}]
    }

    return lodash.map(params.category.children, (category) => ({
      count: category.count,
      id: category.id,
      name: category.name,
      order: category.order,
    }))
  }

  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.LOGIN)})
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
