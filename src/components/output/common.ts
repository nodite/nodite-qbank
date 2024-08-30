import {ConvertOptions, UploadOptions} from '../../types/common.js'
import {Component, Params} from '../common.js'

abstract class Output extends Component {
  public getOutputUsername = (): string => this.outputUsername

  private outputUsername: string

  constructor(vendorUsername: string, outputUsername: string) {
    super(vendorUsername)
    this.outputUsername = outputUsername
  }

  public abstract convert(params: Params, options?: ConvertOptions): Promise<void>

  public abstract upload(params: Params, options?: UploadOptions): Promise<void>
}

type OutputClass = new (vendorUsername: string, outputUsername: string) => Output

export {Output, OutputClass}
