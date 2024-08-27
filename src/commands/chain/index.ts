import {Flags} from '@oclif/core'
import lodash from 'lodash'
import sleep from 'sleep-promise'

import BaseCommand from '../../base.js'
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

    // bank list.
    await this._runBankList(flags)

    const _banks = findAll(await vendor.banks(), flags.bank_list, {fuzzy: true})
    const _wildBank = lodash.find(_banks, {id: '*'})
    const _todoBanks = _wildBank ? await vendor.banks({excludeTtl: true}) : _banks

    for (const _bank of _todoBanks) {
      // cateogry list.
      await this._runCategoryList(flags, _bank)

      const _categories = findAll(await vendor.categories(_bank), flags.category_list, {fuzzy: true})
      const _wildCategory = lodash.find(_categories, {id: '*'})
      const _todoCategories = _wildCategory ? await vendor.categories(_bank, {excludeTtl: true}) : _categories

      for (const _category of _todoCategories) {
        // sheet list.
        await this._runSheetList(flags, _bank, _category)

        const _sheets = findAll(await vendor.sheets(_bank, _category), flags.sheet_list, {fuzzy: true})
        const _wildSheet = lodash.find(_sheets, {id: '*'})
        const _todoSheets = _wildSheet ? [_wildSheet] : _sheets

        for (const _sheet of _todoSheets) {
          // question fetch.
          await this._runQuestionFetch(flags, _bank, _category, _sheet)

          // output for each sheet.
          await this._runOutputConvert(flags, _bank, _category, _sheet)
          await this._runOutputUpload(flags, _bank, _category, _sheet)

          // delay.
          await sleep(flags.delay)
        }
      }
    }
  }

  protected async _runBankList(flags: any): Promise<void> {
    this.log('\n---\n')

    const _argv = ['--vendor', flags.vendor, '--username', flags.username]

    if (lodash.intersection(flags.clean, ['bank.list', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(bank:list)')
    await this.config.runCommand('bank:list', _argv)
  }

  protected async _runCategoryList(flags: any, bank: Bank): Promise<void> {
    const _argv = ['--vendor', flags.vendor, '--username', flags.username, '--bank', bank.name]

    if (lodash.intersection(flags.clean, ['category.list', '*']).length > 0) {
      _argv.push('--clean')
    }

    this.log('\n(category:list)')
    await this.config.runCommand('category:list', _argv)
  }

  protected async _runOutputConvert(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---\n')

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

  protected async _runOutputUpload(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---\n')

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

  protected async _runQuestionFetch(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('\n---\n')

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

  protected async _runSheetList(flags: any, bank: Bank, category: Category): Promise<void> {
    this.log('\n---\n')

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
}
