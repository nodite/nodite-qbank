import path from 'node:path'

import type {CacheRequestConfig} from 'axios-cache-interceptor'
import lodash from 'lodash'

import {LoginOptions} from '../../../types/common.js'
import {OutputClass} from '../../output/common.js'
import Markji from '../../output/fenbi/markji.js'
import FenbiKaoyan from './fenbi-kaoyan.js'

export default class Fenbi extends FenbiKaoyan {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔教育'}

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
  public async login(options?: LoginOptions): Promise<CacheRequestConfig> {
    const config = await new FenbiKaoyan(this.getUsername()).login(options)

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
      // quizChange: 'https://tiku.fenbi.com/activity/userquiz/courseSetChange?courseSetPrefix={{bankPrefix}}',
      quizChange: 'https://tiku.fenbi.com/iphone/{{bankPrefix}}/users/quizChange/0',
    }
  }

  /**
   * Categories meta.
   */
  protected get _fetchCategoryMeta(): Record<string, any> {
    return {
      endpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/categories',
      etRuleEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/etRuleQuestion/categories',
      params: {filter: 'keypoint'},
      pdpgEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/pdpg/categories',
    }
  }

  /**
   * Questions meta.
   */
  protected get _fetchQuestionMeta(): Record<string, any> {
    return {
      etRuleQuestionsEndpoint:
        'https://tiku.fenbi.com/api/{{bankPrefix}}/etRuleQuestion/question-list' +
        '?questionType={{sheetId}}&toPage={{page}}',
      exercisesEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/exercises',
      giantsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/giants',
      incrEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      questionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/questions',
      solutionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/pure/solutions',
      submitEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
      universalAuthQuestionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/auth/questions',
      universalAuthSolutionsEndpoint: 'https://tiku.fenbi.com/api/{{bankPrefix}}/universal/auth/solutions',
    }
  }
}
