import {Flags} from '@oclif/core'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import BaseCommand from '../../base.js'
import {Vendor} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Sheet} from '../../types/sheet.js'
import {findAll} from '../../utils/index.js'

export default class Index extends BaseCommand {
  static args = {}

  static description = 'Chain to qbank'

  static example = [
    `<%= config.bin %> <%= command.id %>
Chain to qbank (./src/commands/chain/index.ts)
`,
  ]

  static flags = {
    bank_list: Flags.string({default: ['*'], delimiter: ',', description: '题库', multiple: true}),
    category_list: Flags.string({default: ['*'], delimiter: ',', description: '分类', multiple: true}),
    clean: Flags.string({
      char: 'r',
      default: [],
      delimiter: ',',
      description: '清除缓存/重新转换',
      multiple: true,
      options: ['*', 'bank.list', 'category.list', 'sheet.list', 'question.fetch', 'output.convert', 'output.upload'],
    }),
    delay: Flags.integer({default: 0, description: '延迟(ms)'}),
    output: Flags.string({default: '', description: '接收方'}),
    output_username: Flags.string({default: '', description: '接收方用户名'}),
    sheet_list: Flags.string({default: ['*'], delimiter: ',', description: '试卷', multiple: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Index)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank.
    await this._wrapBank(flags, {vendor}, async (bank) => {
      // category
      await this._wrapCategory(flags, {bank, vendor}, async (category) => {
        // sheet
        await this._wrapSheet(flags, {bank, category, vendor}, async (sheet) => {
          // question fetch.
          await this._runQuestionFetch(flags, bank, category, sheet)

          // output for each sheet.
          await this._runOutputConvert(flags, bank, category, sheet)
          await this._runOutputUpload(flags, bank, category, sheet)

          // delay.
          await sleep(flags.delay)
        })
      })
    })
  }

  /**
   * bank:list
   */
  protected async _runBankList(flags: any): Promise<void> {
    this.log('\n---')

    const _argv = ['--vendor', flags.vendor, '--username', flags.username]

    if (lodash.intersection(flags.clean, ['bank.list', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(bank:list)')
    await this.config.runCommand('bank:list', _argv)
  }

  /**
   * category:list
   */
  protected async _runCategoryList(flags: any, bank: Bank): Promise<void> {
    this.log('\n---')

    const _argv = ['--vendor', flags.vendor, '--username', flags.username, '--bank', bank.name]

    if (lodash.intersection(flags.clean, ['category.list', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(category:list)')
    await this.config.runCommand('category:list', _argv)
  }

  /**
   * output:convert
   */
  protected async _runOutputConvert(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---')

    const _argv = [
      '--vendor',
      flags.vendor,
      '--username',
      flags.username,
      '--bank',
      bank.name,
      '--category',
      category.name,
      '--sheet',
      sheet.name,
      '--output',
      flags.output,
      '--output_username',
      flags.output_username,
    ]

    if (lodash.intersection(flags.clean, ['output.convert', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(output:convert)')
    await this.config.runCommand('output:convert', _argv)
  }

  /**
   * output:upload
   */
  protected async _runOutputUpload(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---')

    const _argv = [
      '--vendor',
      flags.vendor,
      '--username',
      flags.username,
      '--bank',
      bank.name,
      '--category',
      category.name,
      '--sheet',
      sheet.name,
      '--output',
      flags.output,
      '--output_username',
      flags.output_username,
    ]

    if (lodash.intersection(flags.clean, ['output.upload', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(output:upload)')
    await this.config.runCommand('output:upload', _argv)
  }

  /**
   * question:fetch
   */
  protected async _runQuestionFetch(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---')

    const _argv = [
      '--vendor',
      flags.vendor,
      '--username',
      flags.username,
      '--bank',
      bank.name,
      '--category',
      category.name,
      '--sheet',
      sheet.name,
    ]

    if (lodash.intersection(flags.clean, ['question.fetch', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(question:fetch)')
    await this.config.runCommand('question:fetch', _argv)
  }

  /**
   * sheet:list
   */
  protected async _runSheetList(flags: any, bank: Bank, category: Category): Promise<void> {
    this.log('\n---')

    const _argv = [
      '--vendor',
      flags.vendor,
      '--username',
      flags.username,
      '--bank',
      bank.name,
      '--category',
      category.name,
    ]

    if (lodash.intersection(flags.clean, ['sheet.list', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(sheet:list)')
    await this.config.runCommand('sheet:list', _argv)
  }

  /**
   * Wrap bank.
   */
  protected async _wrapBank(
    flags: any,
    params: {vendor: Vendor},
    todoFn: (bank: Bank) => Promise<void>,
  ): Promise<void> {
    // fetch banks.
    await this._runBankList(flags)

    const _banks = findAll(await params.vendor.banks(), flags.bank_list, {fuzzy: true})

    const _wildBank = lodash.find(_banks, {id: '*'})

    // 所有 bank.
    if (_wildBank) {
      await this._runCategoryList(flags, _wildBank)

      for (const _bank of await params.vendor.banks({excludeTtl: true})) {
        await todoFn(_bank)
      }
    }
    // 部分 bank.
    else {
      for (const _bank of _banks) {
        await this._runCategoryList(flags, _bank)

        await todoFn(_bank)
      }
    }
  }

  /**
   * Wrap category.
   */
  protected async _wrapCategory(
    flags: any,
    params: {bank: Bank; vendor: Vendor},
    todoFn: (category: Category) => Promise<void>,
  ): Promise<void> {
    const _categories = findAll(await params.vendor.categories(params.bank), flags.category_list, {fuzzy: true})

    const _wildCategory = lodash.find(_categories, {id: '*'})

    // 所有 category.
    if (_wildCategory) {
      await this._runSheetList(flags, params.bank, _wildCategory)

      for (const _category of await params.vendor.categories(params.bank, {excludeTtl: true})) {
        await todoFn(_category)
      }
    }
    // 部分 category.
    else {
      for (const _category of _categories) {
        await this._runSheetList(flags, params.bank, _category)

        await todoFn(_category)
      }
    }
  }

  /**
   * Wrap sheet.
   */
  protected async _wrapSheet(
    flags: any,
    params: {bank: Bank; category: Category; vendor: Vendor},
    todoFn: (sheet: Sheet) => Promise<void>,
  ): Promise<void> {
    const _sheets = findAll(await params.vendor.sheets(params.bank, params.category), flags.sheet_list, {fuzzy: true})

    const _wildSheet = lodash.find(_sheets, {id: '*'})

    const _todoSheets = _wildSheet ? [_wildSheet] : _sheets

    for (const _sheet of _todoSheets) {
      await todoFn(_sheet)
    }
  }
}
