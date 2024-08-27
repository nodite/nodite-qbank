import {Flags} from '@oclif/core'
import ttyTable from 'tty-table'

import BaseCommand from '../../base.js'
import {HashKeyScope} from '../../components/cache-pattern.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {find} from '../../utils/index.js'

export default class List extends BaseCommand {
  static args = {}

  static description = 'List sheets'

  static example = [
    `<%= config.bin %> <%= command.id %>
List sheets (./src/commands/sheet/list.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    category: Flags.string({char: 'c', default: '', description: '分类ID/名称/Key'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank.
    const banks = await vendor.banks()
    const bank = find<Bank>(banks, flags.bank) as Bank

    // category.
    const categories = await vendor.categories(bank)
    const category = find<Category>(categories, flags.category) as Category

    // no '*'
    if (category.id !== '*') {
      // Invalidate cache.
      if (flags.clean) await vendor.invalidate(HashKeyScope.SHEETS, bank, category)

      // sheets.
      const sheets = await vendor.sheets(bank, category)

      this.log(
        ttyTable(
          [
            {align: 'left', value: 'id'},
            {align: 'left', value: 'name'},
            {align: 'left', value: 'count'},
          ],
          sheets.map((sheet) => [sheet.id, sheet.name, sheet.count]),
        ).render(),
      )

      return
    }

    // '*'
    for (const _category of await vendor.categories(bank, {excludeTtl: true})) {
      this.log('\n---\n')

      const _argv = [
        '--vendor',
        flags.vendor,
        '--username',
        flags.username,
        '--bank',
        bank.name,
        '--category',
        _category.name,
      ]

      if (flags.clean) _argv.push('--clean')

      this.log('*(sheet:list)')
      await this.config.runCommand('sheet:list', _argv)
    }
  }
}
