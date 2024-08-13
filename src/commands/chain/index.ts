import {Flags} from '@oclif/core'
import lodash from 'lodash'

import BaseCommand from '../../base.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Sheet} from '../../types/sheet.js'

export default class Index extends BaseCommand {
  static args = {}

  static description = 'Chain to qbank'

  static example = [
    `<%= config.bin %> <%= command.id %>
Chain to qbank (./src/commands/chain/index.ts)
`,
  ]

  static flags = {
    invalidate: Flags.string({
      char: 'i',
      default: [],
      description: '清除缓存/重新转换',
      multiple: true,
      options: ['bank.list', 'category.list', 'sheet.list', 'question.fetch', 'output.convert', 'output.upload'],
    }),
    output: Flags.string({char: 'o', default: '', description: '接收方'}),
    outputUsername: Flags.string({default: '', description: '接收方用户名'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Index)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // banks.
    await this._runBankCommand(flags)

    for (const bank of await vendor.banks()) {
      this.log('\n---')

      this.log(`\n题库: ${bank.name}`)
      await this._runCategoryCommand(flags, bank)

      for (const category of await vendor.categories(bank)) {
        this.log(`\n分类: ${category.name}`)
        await this._runSheetCommand(flags, bank, category)

        for (const sheet of await vendor.sheets(bank, category)) {
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
      lodash.filter(['-v', flags.vendor, '-u', flags.username, flags.invalidate.includes('bank.list') ? '-i' : '']),
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
        flags.invalidate.includes('category.list') ? '-i' : '',
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
        flags.invalidate.includes('output.convert') ? '-r' : '',
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
        flags.invalidate.includes('output.upload') ? '-r' : '',
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
        flags.invalidate.includes('question.fetch') ? '-r' : '',
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
        flags.invalidate.includes('sheet.list') ? '-i' : '',
      ]),
    )
  }
}
