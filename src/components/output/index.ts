import {ComponentMeta} from '../common.js'
import {Output, OutputClass} from './common.js'

export default class OutputManager {
  public static getMeta(cls: Output | OutputClass): ComponentMeta {
    const _cls = cls instanceof Output ? cls.constructor : cls
    return (_cls as typeof Output).META
  }

  public static getMetas(clses: Output[] | OutputClass[]): ComponentMeta[] {
    return clses.map((cls) => OutputManager.getMeta(cls))
  }
}
