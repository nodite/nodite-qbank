import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {ConvertOptions, UploadOptions} from '../../types/common.js'
import {Sheet} from '../../types/sheet.js'
import {Component} from '../common.js'
import {Vendor} from '../vendor/common.js'

type Params = {
  bank: Bank
  category: Category
  sheet: Sheet
  vendor: Vendor
}

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

export {Output, OutputClass, Params}
