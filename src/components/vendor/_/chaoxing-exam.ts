import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'
import md5 from 'md5'
import {HTMLElement, parse} from 'node-html-parser'

import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {FetchOptions, LoginOptions} from '../../../types/common.js'
import {Sheet} from '../../../types/sheet.js'
import {safeName, throwError} from '../../../utils/index.js'
import axios from '../../axios/index.js'
// import puppeteer from '../../../utils/puppeteer.js'
import {OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope} from '../common.js'
import ChaoXing from './chaoxing.js'

/**
 * @see https://github.com/aglorice/new_xxt/blob/red/my_xxt/api.py
 */
export default class ChaoXingExam extends ChaoXing {
  public static META = {key: path.parse(import.meta.url).name, name: '超星自测'}

  public get allowedOutputs(): Record<string, OutputClass> {
    return {}
  }

  /**
   * Login.
   */
  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    return new ChaoXing(this.getUsername()).login(options)
  }

  /**
   * Categories.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.CATEGORIES)})
  protected async fetchCategories(params: {bank: Bank}): Promise<Category[]> {
    const config = await this.login()

    const dirs = await axios.get(
      'https://mooc1.chaoxing.com/exam-ans/exam/selftest-qbankdirs-new',
      lodash.merge({}, config, {
        params: {
          classId: params.bank.meta!.clazzId,
          courseId: params.bank.meta!.courseId,
          cpi: params.bank.meta!.cpi,
          doNoRepeat: false,
        },
      }),
    )

    const categories = [] as Category[]

    const _convert = async (li: HTMLElement, index: number, parentId: string): Promise<Category> => {
      const name = await safeName((li.querySelector('> div.marbom16 > p.fl')?.textContent ?? '').trim())
      const id = md5(JSON.stringify([parentId, index, name]))

      const children = [] as Category[]

      for (const _nextLi of li.querySelectorAll('> ul > li')) {
        children.push(await _convert(_nextLi, children.length, id))
      }

      const dirids = li.querySelector('> div.marbom16 > div.fr > input.dirCheckNum')?.getAttribute('dirids') ?? '[]'
      const count = Number(li.querySelector('> div.marbom16 > div.fr > span')?.textContent ?? 0)

      return {
        children,
        count: count || lodash.sumBy(children, 'count'),
        id,
        meta: {dirids: JSON.parse(dirids)},
        name,
        order: index,
      }
    }

    for (const dir of parse(dirs.data).querySelectorAll('div.checkFromDir > ul > li')) {
      categories.push(await _convert(dir as any, categories.length, params.bank.id))
    }

    return categories
  }

  /**
   * Sheet.
   */
  @Cacheable({cacheKey: cacheKeyBuilder(HashKeyScope.SHEETS)})
  protected async fetchSheet(params: {bank: Bank; category: Category}, _options?: FetchOptions): Promise<Sheet[]> {
    return params.category.children
  }

  /**
   * Fetch questions.
   */
  public async fetchQuestions(
    _params: {bank: Bank; category: Category; sheet: Sheet},
    _options?: FetchOptions,
  ): Promise<void> {
    // const config = await this.login()

    // goTest(courseId, tId/examId, id, endTime, paperId, isRetest,lookpaperEnc)
    // const exam = await this.getExam(params)
    // const click = exam?.querySelector('> div')?.getAttribute('onclick') ?? ''
    // const examId = lodash.trim(click.match(/goTest\(([^)]+)\)/)![1].split(',')[1], "'")

    // const examnotes = URL.parse('https://mooc1.chaoxing.com/exam-ans/exam/test/examcode/examnotes')!
    // examnotes.searchParams.set('classId', params.bank.meta!.clazzId)
    // examnotes.searchParams.set('courseId', params.bank.meta!.courseId)
    // examnotes.searchParams.set('cpi', params.bank.meta!.cpi)
    // examnotes.searchParams.set('examId', examId)

    // const examnotesPage = await puppeteer.page('chaoxing-exam', examnotes.toString(), config)

    // await examnotesPage.evaluate((data) => {})

    // const examnotes = await axios.get(
    //   'https://mooc1.chaoxing.com/exam-ans/exam/test/examcode/examnotes',
    //   lodash.merge({}, config, {
    //     params: {
    //       classId: params.bank.meta!.clazzId,
    //       courseId: params.bank.meta!.courseId,
    //       cpi: params.bank.meta!.cpi,
    //       examId,
    //     },
    //   }),
    // )

    // const examnotesRoot = parse(examnotes.data)
    // const answerId = examnotesRoot.querySelector('input#answerId')?.getAttribute('value')
    // const sdlkey = examnotesRoot.querySelector('input#secondDeviceLiveKey')?.getAttribute('value')
    // const facekey = examnotesRoot.querySelector('input#facekey')?.getAttribute('value')
    // const captchavalidate = examnotesRoot.querySelector('input#captchavalidate')?.getAttribute('value')
    // const captchaCaptchaId = examnotesRoot.querySelector('input#captchaCaptchaId')?.getAttribute('value')

    throw new Error('Method not implemented.')
  }

  /**
   * Get exam.
   */
  protected async getExam(params: {bank: Bank; category: Category; sheet: Sheet}): Promise<HTMLElement> {
    const config = await this.login()

    // to exam view.
    const examView = await axios.get(
      'https://mooc1.chaoxing.com/mooc2/exam/exam-list',
      lodash.merge({}, config, {
        params: {
          clazzid: params.bank.meta!.clazzId,
          courseid: params.bank.meta!.courseId,
          cpi: params.bank.meta!.cpi,
          enc: params.bank.meta!.examEnc,
          openc: params.bank.meta!.openc,
          t: Date.now(),
          type: 1,
          ut: 's',
        },
      }),
    )

    const exam = lodash.find(parse(examView.data).querySelectorAll('div.has-content ul > li'), (li) => {
      const title = li.querySelector('div.right-content > p.fl')?.textContent
      return title === `${params.category.name} > ${params.sheet.name}`
    })

    if (exam) return exam

    const created = await axios.post(
      'https://mooc1.chaoxing.com/exam-ans/mooc2/exam/create-self-test',
      {
        classId: params.bank.meta!.clazzId,
        courseId: params.bank.meta!.courseId,
        cpi: params.bank.meta!.cpi,
        createType: 0,
        doNoRepeat: false,
        limitTime: '',
        openc: params.bank.meta!.openc,
        questionNum: params.sheet.count,
        recommendSet: JSON.stringify({}),
        selectDirs: JSON.stringify([{dirs: params.sheet.meta!.dirids, selectNum: params.sheet.count}]),
        selectType: 1,
        selectTypes: JSON.stringify([]),
        selftestMode: 1,
        title: `${params.category.name} > ${params.sheet.name}`,
      },
      lodash.merge({}, config, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
      }),
    )

    if (!created.data.status) {
      throwError('Failed to create exam.', {params})
    }

    const {taskId} = created.data

    const status = await axios.get(
      'https://mooc1.chaoxing.com/exam-ans/mooc2/exam/selftest-autopapertask-status',
      lodash.merge({}, config, {
        params: {
          classId: params.bank.meta!.clazzId,
          courseId: params.bank.meta!.courseId,
          cpi: params.bank.meta!.cpi,
          taskId,
        },
      }),
    )

    if (!status.data.status || status.data.taskStatus !== 'ok') {
      throwError('Failed to check exam status.', {params})
    }

    return this.getExam(params)
  }
}
