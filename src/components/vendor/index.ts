import BiguoChapter from './_/biguo-chapter.js'
import BiguoFree from './_/biguo-free.js'
import BiguoReal from './_/biguo-real.js'
import BiguoVip from './_/biguo-vip.js'
import ChaoXing from './_/chaoxing.js'
import Demo from './_/demo.js'
import {Fenbi} from './_/fenbi.js'
import FenbiKaoyan from './_/fenbi-kaoyan.js'
import _ from './_/index.js'
import JsonFile from './_/json-file.js'
import Markji from './_/markji.js'
import MyTodoAws from './_/mytodo-aws.js'
import Wantiku from './_/wantiku.js'
import WantikuChapter from './_/wantiku-chapter.js'
import Wx233 from './_/wx233.js'

export default class VendorManager {
  protected static components = {
    [BiguoChapter.META.key]: BiguoChapter,
    [BiguoFree.META.key]: BiguoFree,
    [BiguoReal.META.key]: BiguoReal,
    [BiguoVip.META.key]: BiguoVip,
    [ChaoXing.META.key]: ChaoXing,
    [Demo.META.key]: Demo,
    [Fenbi.META.key]: Fenbi,
    [FenbiKaoyan.META.key]: FenbiKaoyan,
    [JsonFile.META.key]: JsonFile,
    [Markji.META.key]: Markji,
    [MyTodoAws.META.key]: MyTodoAws,
    [Wantiku.META.key]: Wantiku,
    [WantikuChapter.META.key]: WantikuChapter,
    [Wx233.META.key]: Wx233,
  }

  public static getClass(name: string) {
    return this.components[name]
  }

  public static getMetas() {
    return Object.values(this.components).map((component) => component.META)
  }

  public static getNames() {
    return _.list()
  }
}
