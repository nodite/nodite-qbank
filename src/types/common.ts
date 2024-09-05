import {Output} from '../components/output/common.js'
import {Vendor} from '../components/vendor/common.js'
import {Bank} from './bank.js'
import {Category} from './category.js'
import {Sheet} from './sheet.js'

type AssetString = {
  assets: Record<string, string>
  text: string
}

type FetchOptions = {
  refetch?: boolean
}

type ConvertOptions = {
  reconvert?: boolean
}

type ParseOptions = {
  imgSrcHandler?: (src: string) => string
  style?: string
  width?: number
}

type UploadOptions = {
  reupload?: boolean
  totalEmit?: (total: number) => void
}

type ComponentMeta = {
  key: string
  name: string
}

type Params = {
  bank: Bank
  category: Category
  output?: Output
  sheet: Sheet
  vendor: Vendor
}

export {AssetString, ComponentMeta, ConvertOptions, FetchOptions, Params, ParseOptions, UploadOptions}
