import path from 'node:path'

import {ApiDelegate} from '../../../@types/vendor/fenbi.js'
import Fenbi from './fenbi.js'

/**
 * Fenbi Kaoyan.
 */
export default class FenbiKaoyan extends Fenbi {
  public static META = {key: path.parse(import.meta.url).name, name: '粉笔考研'}

  protected get apiDelegate(): ApiDelegate {
    return {
      ApiParams: {deep: true, level: 0},
      CreateExerciseApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/exercises',
      dataPath: 'data',
      EmptyMessage: '请前往 <粉笔考研> App 加入题库: 练习 > 右上角+号',
      GetCategoriesApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/categories',
      GetExerciseApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/exercises/{{exerciseId}}',
      GetExerciseUnfinishedApi:
        'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/category-exercises-unfinished',
      GetFavoriteQuizListApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/kaoyan/selected_quiz_list',
      GetMaterialsApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/pure/materials',
      GetPaperListApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/papers',
      GetQuestionsApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/universal/questions',
      GetSolutionsApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/pure/solutions',
      PostIncrEndpoint: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/incr',
      PostSubmitApi: 'https://schoolapi.fenbi.com/kaoyan/iphone/{{bankPrefix}}/async/exercises/{{exerciseId}}/submit',
      UpdateQuizApi: 'https://schoolapi.fenbi.com/kaoyan/ipad/{{bankPrefix}}/users/quiz/{{quizId}}',
    }
  }
}
