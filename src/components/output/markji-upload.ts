import sleep from 'sleep-promise'

import {ConvertOptions, QBankParams} from '../../@types/common.js'
import {emitter} from '../../utils/event.js'
import Markji from './markji.js'

export default class MarkjiUpload extends Markji {
  public static META = {key: 'markji-upload', name: 'Markji仅上传'}

  public async convert(qbank: QBankParams, _options: ConvertOptions): Promise<void> {
    emitter.emit('output.convert.count', qbank.sheet.count)
    await sleep(500)
    emitter.closeListener('output.convert.count')
  }
}
