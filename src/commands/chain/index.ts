import {Flags} from '@oclif/core'
import colors from 'ansi-colors'
import lodash from 'lodash'

import BaseCommand from '../../base.js'
import {Vendor} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Sheet} from '../../types/sheet.js'
import {fiindAll, getMemoryUsage} from '../../utils/index.js'

export default class Index extends BaseCommand {
  static args = {}

  static description = '链式调用 qbank 命令'

  static example = [
    `<%= config.bin %> <%= command.id %>
Chain to qbank (./src/commands/chain/index.ts)
`,
  ]

  static flags = {
    'bank-list': Flags.string({default: ['*'], delimiter: ',', description: '题库', multiple: true}),
    'category-list': Flags.string({default: ['*'], delimiter: ',', description: '分类', multiple: true}),
    clean: Flags.string({
      char: 'r',
      default: [],
      delimiter: ',',
      description: '清除缓存/重新转换',
      multiple: true,
      options: ['*', 'bank.list', 'category.list', 'sheet.list', 'question.fetch', 'output.convert', 'output.upload'],
    }),
    output: Flags.string({char: 'o', default: '', description: '接收方'}),
    'output-username': Flags.string({default: '', description: '接收方用户名'}),
    'sheet-list': Flags.string({default: ['*'], delimiter: ',', description: '试卷', multiple: true}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Index)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank.
    await this._wrapBank({vendor}, async (bank) => {
      this.log(colors.green(`\n|=== bank = (${bank.name}) ===>`))

      // category
      await this._wrapCategory({bank, vendor}, async (category) => {
        this.log(colors.green(`\n\t|=== category = (${category.name}) ===>`))

        // sheet
        await this._wrapSheet({bank, category, vendor}, async (sheet) => {
          this.log(colors.green(`\n\t\t|=== sheet = (${sheet.name}) ===>`))

          // question fetch.
          await this._runQuestionFetch(bank, category, sheet)

          // output for each sheet.
          await this._runOutputConvert(bank, category, sheet)
          await this._runOutputUpload(bank, category, sheet)

          // print memory usage.
          this.log('\n' + JSON.stringify(getMemoryUsage()))

          this.log(colors.green('\n\t\t|=== sheet ===|'))
        })

        this.log(colors.green('\n\t|=== category ===|'))
      })

      this.log(colors.green('\n|=== bank ===|'))
    })

    this.log(colors.green('\n|===|'))
  }

  /**
   * bank:list
   */
  protected async _runBankList(): Promise<void> {
    const {flags} = await this.parse(Index)

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
  protected async _runCategoryList(bank: Bank): Promise<void> {
    const {flags} = await this.parse(Index)

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
  protected async _runOutputConvert(bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    const {flags} = await this.parse(Index)

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
      '--output-username',
      flags['output-username'],
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
  protected async _runOutputUpload(bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    const {flags} = await this.parse(Index)

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
      '--output-username',
      flags['output-username'],
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
  protected async _runQuestionFetch(bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    const {flags} = await this.parse(Index)

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
  protected async _runSheetList(bank: Bank, category: Category): Promise<void> {
    const {flags} = await this.parse(Index)

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
  protected async _wrapBank(params: {vendor: Vendor}, todoFn: (bank: Bank) => Promise<void>): Promise<void> {
    const {flags} = await this.parse(Index)

    // fetch banks.
    await this._runBankList()

    let _banks = fiindAll(await params.vendor.banks(), flags['bank-list'] as string[], {fuzzy: true})

    const _wildBank = lodash.find(_banks, {id: '*'})

    if (_wildBank) {
      _banks = await params.vendor.banks({excludeTtl: true})
    }

    for (const _bank of _banks) {
      await this._runCategoryList(_bank)

      await todoFn(_bank)
    }
  }

  /**
   * Wrap category.
   */
  protected async _wrapCategory(
    params: {bank: Bank; vendor: Vendor},
    todoFn: (category: Category) => Promise<void>,
  ): Promise<void> {
    const {flags} = await this.parse(Index)

    let _categories = fiindAll(await params.vendor.categories(params), flags['category-list'] as string[], {
      excludeKey: ['children'],
      fuzzy: true,
    })

    const _wildCategory = lodash.find(_categories, {id: '*'})

    if (_wildCategory) {
      _categories = await params.vendor.categories(params, {excludeTtl: true})
    }

    for (const _category of _categories) {
      await this._runSheetList(params.bank, _category)

      await todoFn(_category)
    }
  }

  /**
   * Wrap sheet.
   */
  protected async _wrapSheet(
    params: {bank: Bank; category: Category; vendor: Vendor},
    todoFn: (sheet: Sheet) => Promise<void>,
  ): Promise<void> {
    const {flags} = await this.parse(Index)

    let _sheets = fiindAll(await params.vendor.sheets(params), flags['sheet-list'] as string[], {
      fuzzy: true,
    })

    const _wildSheet = lodash.find(_sheets, {id: '*'})

    if (_wildSheet) {
      _sheets = await params.vendor.sheets(params, {excludeTtl: true})
    }

    for (const _sheet of _sheets) {
      await todoFn(_sheet)
    }
  }
}
