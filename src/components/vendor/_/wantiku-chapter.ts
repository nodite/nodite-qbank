import {CacheRequestConfig} from 'axios-cache-interceptor'
import path from 'node:path'

import Wantiku from './wantiku.js'

export default class WantikuChapter extends Wantiku {
  public static META = {key: path.parse(import.meta.url).name, name: '万题库·章节练习'}

  URL_CATEGORY = 'https://api.wantiku.com/api/BrushQuestion/ChapterCustomSpecialTree'

  URL_QUESTION = 'https://api.wantiku.com/api/BrushQuestion/ChapterCustomPaper'

  /**
   * Login.
   */
  public login(password?: string): Promise<CacheRequestConfig> {
    return new Wantiku(this.getUsername()).login(password)
  }
}
