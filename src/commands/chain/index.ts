import {Flags} from '@oclif/core'
import lodash from 'lodash'

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
    banks: Flags.string({char: 'b', default: '', description: '题库'}),
    categories: Flags.string({char: 'c', default: '', description: '分类'}),
    clean: Flags.string({
      char: 'r',
      default: [],
      description: '清除缓存/重新转换',
      multiple: true,
      options: ['bank.list', 'category.list', 'sheet.list', 'question.fetch', 'output.convert', 'output.upload'],
    }),
    output: Flags.string({char: 'o', default: '', description: '接收方'}),
    outputUsername: Flags.string({default: '', description: '接收方用户名'}),
    sheets: Flags.string({char: 's', default: '', description: '试卷'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Index)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // banks.
    await this._runBankCommand(flags)

    const _banks = findAll(await vendor.banks(), flags.banks.split(','), {fuzzy: true})

    for (const bank of _banks) {
      this.log('\n---')

      this.log(`\n题库: ${bank.name}`)
      await this._runCategoryCommand(flags, bank)

      const _categories = findAll(await vendor.categories(bank), flags.categories.split(','), {fuzzy: true})

      for (const category of _categories) {
        this.log(`\n分类: ${category.name}`)
        await this._runSheetCommand(flags, bank, category)

        const _sheets = findAll(await vendor.sheets(bank, category), flags.sheets.split(','), {fuzzy: true})

        for (const sheet of _sheets) {
          this.log(`\n试卷: ${sheet.name}`)
          await this._runQuestionCommand(flags, bank, category, sheet)

          this.log(`\n接收方: ${flags.output}`)
          await this._runOutputCommand(flags, bank, category, sheet)
        }
      }
    }
  }

  protected async _runBankCommand(flags: any): Promise<void> {
    this.log('(bank:list)')
    await this.config.runCommand(
      'bank:list',
      lodash.filter(['-v', flags.vendor, '-u', flags.username, flags.clean.includes('bank.list') ? '-r' : '']),
    )
  }

  protected async _runCategoryCommand(flags: any, bank: Bank): Promise<void> {
    this.log('(category:list)')
    await this.config.runCommand(
      'category:list',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        flags.clean.includes('category.list') ? '-r' : '',
      ]),
    )
  }

  protected async _runOutputCommand(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('(output:convert)')
    await this.config.runCommand(
      'output:convert',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        '-c',
        category.name,
        '-s',
        sheet.name,
        '-o',
        flags.output,
        '--outputUsername',
        flags.outputUsername,
        flags.clean.includes('output.convert') ? '-r' : '',
      ]),
    )

    this.log('(output:upload)')
    await this.config.runCommand(
      'output:upload',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        '-c',
        category.name,
        '-s',
        sheet.name,
        '-o',
        flags.output,
        '--outputUsername',
        flags.outputUsername,
        flags.clean.includes('output.upload') ? '-r' : '',
      ]),
    )
  }

  protected async _runQuestionCommand(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log('(question:fetch)')
    await this.config.runCommand(
      'question:fetch',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        '-c',
        category.name,
        '-s',
        sheet.name,
        flags.clean.includes('question.fetch') ? '-r' : '',
      ]),
    )
  }

  protected async _runSheetCommand(flags: any, bank: Bank, category: Category): Promise<void> {
    this.log('(sheet:list)')
    await this.config.runCommand(
      'sheet:list',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        '-c',
        category.name,
        flags.clean.includes('sheet.list') ? '-r' : '',
      ]),
    )
  }
}
