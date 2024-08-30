import {ConvertOptions, UploadOptions} from '../../types/common.js'
import {Params} from '../common.js'
import {Output} from './common.js'

export default class File extends Output {
  public static META = {key: 'file', name: '文件'}

  public async convert(_params: Params, _options: ConvertOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public async upload(_params: Params, _options: UploadOptions): Promise<void> {
    throw new Error('Method not implemented.')
  }
}
