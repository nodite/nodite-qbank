import Demo from './demo.js'
import Fenbi from './fenbi.js'
import {Vendor} from './main.js'

type VendorClass = new () => Vendor

export default class VendorManager {
  private static vendors: {[key: string]: VendorClass} = {
    [Demo.name]: Demo,
    [Fenbi.name]: Fenbi,
  }

  public static getClass(name: string): VendorClass {
    return this.vendors[name]
  }

  public static getNames(): string[] {
    return Object.keys(this.vendors)
  }
}
