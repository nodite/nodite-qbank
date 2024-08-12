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
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
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

    // Invalidate cache.
    if (flags.invalidate) await vendor.invalidate(HashKeyScope.SHEETS, bank, category)

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
  }
}
