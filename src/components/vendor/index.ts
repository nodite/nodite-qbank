import BiguoFree from './biguo-free.js'
import BiguoReal from './biguo-real.js'
import BiguoVip from './biguo-vip.js'
import Demo from './demo.js'
import FenbiKaoyan from './fenbi-kaoyan.js'
import JsonFile from './json-file.js'
import Markji from './markji.js'
import WantikuZikao from './wantiku.js'

export default class VendorManager {
  protected static components = {
    [BiguoFree.META.key]: BiguoFree,
    [BiguoReal.META.key]: BiguoReal,
    [BiguoVip.META.key]: BiguoVip,
    [Demo.META.key]: Demo,
    [FenbiKaoyan.META.key]: FenbiKaoyan,
    [JsonFile.META.key]: JsonFile,
    [Markji.META.key]: Markji,
    [WantikuZikao.META.key]: WantikuZikao,
  }

  public static getClass(name: string) {
    return this.components[name]
  }

  public static getMetas() {
    return Object.values(this.components).map((component) => component.META)
  }

  public static getNames() {
    return Object.keys(this.components)
  }
}
