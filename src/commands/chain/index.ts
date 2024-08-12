/* eslint-disable @typescript-eslint/no-explicit-any */
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
      options: ['bank', 'category', 'sheet', 'question.fetch', 'question.convert'],
    }),
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
        }
      }
    }
  }

  protected async _runBankCommand(flags: any): Promise<void> {
    await this.config.runCommand(
      'bank:list',
      lodash.filter(['-v', flags.vendor, '-u', flags.username, flags.invalidate.includes('bank') ? '-i' : '']),
    )
  }

  protected async _runCategoryCommand(flags: any, bank: Bank): Promise<void> {
    await this.config.runCommand(
      'category:list',
      lodash.filter([
        '-v',
        flags.vendor,
        '-u',
        flags.username,
        '-b',
        bank.name,
        flags.invalidate.includes('category') ? '-i' : '',
      ]),
    )
  }

  protected async _runQuestionCommand(flags: any, bank: Bank, category: Category, sheet: Sheet): Promise<void> {
    this.log(`Fetch questions:`)
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

    this.log(`Convert questions:`)
    // await this.config.runCommand(
    //   'question:convert',
    //   lodash.filter([
    //     '-v',
    //     flags.vendor,
    //     '-u',
    //     flags.username,
    //     '-b',
    //     bank.name,
    //     '-c',
    //     category.name,
    //     '-s',
    //     sheet.name,
    //     flags.invalidate.includes('question.convert') ? '-r' : '',
    //   ]),
    // )
  }

  protected async _runSheetCommand(flags: any, bank: Bank, category: Category): Promise<void> {
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
        flags.invalidate.includes('sheet') ? '-i' : '',
      ]),
    )
  }
}
