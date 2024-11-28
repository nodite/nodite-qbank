import sleep from 'sleep-promise'

import {ConvertOptions, Params} from '../../types/common.js'
import {emitter} from '../../utils/event.js'
import Markji from './markji.js'

export default class MarkjiUpload extends Markji {
  public static META = {key: 'markji-upload', name: 'Markji仅上传'}

  public async convert(params: Params, _options: ConvertOptions): Promise<void> {
    emitter.emit('output.convert.count', params.sheet.count)
    await sleep(1000)
    emitter.closeListener('output.convert.count')
  }
}
