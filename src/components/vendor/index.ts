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
import LearnABC from './_/learnabc.js'
import Markji from './_/markji.js'
import MyTodoAws from './_/mytodo-aws.js'
import Shangfen from './_/shangfen.js'
import Wantiku from './_/wantiku.js'
import WantikuChapter from './_/wantiku-chapter.js'
import Wx233 from './_/wx233.js'
import Yiguo from './_/yiguo.js'

export default class VendorManager {
  protected static components = {
    [BiguoChapter.META.key]: BiguoChapter, // done
    [BiguoFree.META.key]: BiguoFree, // done
    [BiguoReal.META.key]: BiguoReal, // done
    [BiguoVip.META.key]: BiguoVip, // done
    [ChaoXing.META.key]: ChaoXing, // done
    [Demo.META.key]: Demo, // skip
    [Fenbi.META.key]: Fenbi, // WIP
    [FenbiKaoyan.META.key]: FenbiKaoyan, // done
    [JsonFile.META.key]: JsonFile, // done
    [LearnABC.META.key]: LearnABC, // WIP
    [Markji.META.key]: Markji, // skip
    [MyTodoAws.META.key]: MyTodoAws, // done
    [Shangfen.META.key]: Shangfen, // implement
    [Wantiku.META.key]: Wantiku, // done
    [WantikuChapter.META.key]: WantikuChapter, // done
    [Wx233.META.key]: Wx233, // done
    [Yiguo.META.key]: Yiguo, // implement
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
