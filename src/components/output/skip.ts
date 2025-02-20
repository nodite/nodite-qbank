import sleep from 'sleep-promise'

import {ConvertOptions, QBankParams, UploadOptions} from '../../@types/common.js'
import {emitter} from '../../utils/event.js'
import {Output} from './common.js'

export default class Skip extends Output {
  public static META = {key: 'skip', name: '跳过'}

  public async convert(qbank: QBankParams, _options: ConvertOptions): Promise<void> {
    emitter.emit('output.convert.count', qbank.sheet.count)
    await sleep(500)
    emitter.closeListener('output.convert.count')
  }

  public async upload(qbank: QBankParams, _options: UploadOptions): Promise<void> {
    emitter.emit('output.upload.count', qbank.sheet.count)
    await sleep(500)
    emitter.closeListener('output.upload.count')
  }
}
