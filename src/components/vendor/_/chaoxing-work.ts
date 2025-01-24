import path from 'node:path'

import {Cacheable} from '@type-cacheable/core'
import {CacheRequestConfig} from 'axios-cache-interceptor'

import {Bank} from '../../../types/bank.js'
import {Category} from '../../../types/category.js'
import {LoginOptions} from '../../../types/common.js'
import {OutputClass} from '../../output/common.js'
import {cacheKeyBuilder, HashKeyScope} from '../common.js'
import ChaoXing from './chaoxing.js'

/**
 * @see https://github.com/aglorice/new_xxt/blob/red/my_xxt/api.py
 */
export default class ChaoXingWork extends ChaoXing {
  public static META = {key: path.parse(import.meta.url).name, name: '超星作业'}

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
  protected async fetchCategories(_params: {bank: Bank}): Promise<Category[]> {
    // const config = await this.login()

    // // to course page.
    // const courseView = await axios.get(
    //   params.bank.meta!.courseUrl,
    //   lodash.merge({}, config, {
    //     maxRedirects: 0,
    //     params: {
    //       catalogId: 0,
    //       size: 500,
    //       start: 0,
    //       superstarClass: 0,
    //       v: Date.now(),
    //     },
    //   } as AxiosRequestConfig),
    // )

    // const root = parse(courseView.data)

    // const workEnc = root.querySelector('input#workEnc')?.getAttribute('value')

    // // to work view.
    // const workView = await axios.get(
    //   'https://mooc1.chaoxing.com/mooc2/work/list',
    //   lodash.merge({}, courseView.config, config, {
    //     headers: {
    //       Host: 'mooc1.chaoxing.com',
    //       Referer: 'https://mooc2-ans.chaoxing.com/',
    //     },
    //     params: {
    //       classId: params.bank.meta!.clazzId,
    //       courseId: params.bank.meta!.courseId,
    //       enc: workEnc,
    //       ut: 's',
    //     },
    //   }),
    // )

    // const workList = lodash.map(parse(workView.data).querySelectorAll('li'), (li) => {
    //   const url = li.getAttribute('data')
    //   return li
    // })

    throw new Error('Method not implemented.')
  }
}
