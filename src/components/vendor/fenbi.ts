import type {CacheRequestConfig} from 'axios-cache-interceptor'

import lodash from 'lodash'

import {OutputClass} from '../output/common.js'
import Markji from '../output/fenbi/markji.js'
import FenbiKaoyan from './fenbi-kaoyan.js'

export class Fenbi extends FenbiKaoyan {
  public static META = {key: 'fenbi', name: '粉笔教育'}

  /**
   * Allowed outputs.
   */
  public get allowedOutputs(): Record<string, OutputClass> {
    return {
      [Markji.META.key]: Markji,
    }
  }

  /**
   * Login.
   */
  public async login(password?: string): Promise<CacheRequestConfig> {
    const config = await new FenbiKaoyan(this.getUsername()).login(password)

    config.params = lodash.merge({}, config.params, {
      app: 'gwy',
    })

    return config
  }

  /**
   * Bank meta.
   */
  protected get _fetchBankMeta(): Record<string, any> {
    return {
      emptyMessage: '请前往 <粉笔> App 加入题库: 练习 > 右上角+号',
      endpoint: 'https://tiku.fenbi.com/activity/userquiz/getFavoriteQuizList',
      path: 'data.data.favoriteQuizVO',
    }
  }

  /**
   * Categories meta.
   */
  protected get _fetchCategoryMeta(): Record<string, any> {
    return {
      endpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/categories',
      params: {filter: 'keypoint'},
    }
  }

  /**
   * Questions meta.
   */
  protected get _fetchQuestionMeta(): Record<string, any> {
    return {
      exercisesEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/{{exerciseType}}',
      incrEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      questionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/questions',
      solutionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/{{solutionType}}/solutions',
      submitEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
    }
  }
}
