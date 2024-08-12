import {VendorClass} from './common.js'
import Demo from './demo.js'
import FenbiKaoyan from './fenbi-kaoyan.js'

export default class VendorManager {
  private static vendors: {[key: string]: VendorClass} = {
    [Demo.VENDOR_NAME]: Demo,
    [FenbiKaoyan.VENDOR_NAME]: FenbiKaoyan,
  }

  public static getClass(name: string): VendorClass {
    return this.vendors[name]
  }

  public static getVendorNames(): string[] {
    return Object.keys(this.vendors)
  }
}
