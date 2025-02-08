import {ConvertOptions, QBankParams, UploadOptions} from '../../types/common.js'
import {Output} from './common.js'

export default class File extends Output {
  public static META = {key: 'file', name: '文件'}

  public async convert(_qbank: QBankParams, _options: ConvertOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async upload(_qbank: QBankParams, _options: UploadOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
