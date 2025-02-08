import {ConvertOptions, QBankParams, UploadOptions} from '../../types/common.js'
import {Component} from '../common.js'

abstract class Output extends Component {
  private outputUsername: string

  constructor(vendorUsername: string, outputUsername: string) {
    super(vendorUsername)
    this.outputUsername = outputUsername
  }

  public abstract convert(qbank: QBankParams, options?: ConvertOptions): Promise<void>

  public getOutputUsername = (): string => this.outputUsername

  public abstract upload(qbank: QBankParams, options?: UploadOptions): Promise<void>
}

type OutputClass = new (vendorUsername: string, outputUsername: string) => Output

export {Output, OutputClass}
