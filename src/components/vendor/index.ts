import Demo from './demo.js'
import FenbiKaoyan from './fenbi-kaoyan.js'
import Markji from './markji.js'
import WantikuZikao from './wantiku-zikao.js'

export default class VendorManager {
  protected static components = {
    [Demo.META.key]: Demo,
    [FenbiKaoyan.META.key]: FenbiKaoyan,
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
