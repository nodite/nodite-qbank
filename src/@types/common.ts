import {Output} from '../components/output/common.js'
import {Vendor} from '../components/vendor/common.js'
import {Bank} from './bank.js'
import {Category} from './category.js'
import {Sheet} from './sheet.js'

type AssetString = {
  assets: Record<string, string>
  text: string
}

type LoginOptions = {
  clean?: boolean
  password?: string
}

type FetchOptions = {
  refetch?: boolean
}

type ConvertOptions = {
  reconvert?: boolean
}

type ParseOptions = {
  showIndex?: boolean
  skipInput?: boolean
  srcHandler?: (src: string) => string | string[]
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

type QBankParams = {
  bank: Bank
  category: Category
  output?: Output
  sheet: Sheet
  vendor: Vendor
}

type SafeNameOptions = {
  length?: number
}

export {
  AssetString,
  ComponentMeta,
  ConvertOptions,
  FetchOptions,
  LoginOptions,
  ParseOptions,
  QBankParams,
  SafeNameOptions,
  UploadOptions,
}
