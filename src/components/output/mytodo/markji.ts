import {AssetString, Params} from '../../../types/common.js'
import MarkjiBase from '../markji.js'

export default class Markji extends MarkjiBase {
  /**
   * _output.
   */
  protected async _output(_question: any, _params: Params): Promise<AssetString> {
    return {} as AssetString
  }
}
