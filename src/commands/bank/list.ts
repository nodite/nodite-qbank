import ttyTable from 'tty-table'

import BaseCommand from '../../base.js'
import {HashKeyScope} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'

export default class List extends BaseCommand {
  static args = {}

  static description = 'List banks'

  static example = [
    `<%= config.bin %> <%= command.id %>
List banks (./src/commands/course/list.ts)
`,
  ]

  static flags = {}

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // Invalidate cache.
    if (flags.clean) await vendor.invalidate(HashKeyScope.BANKS)

    // banks.
    const banks = await vendor.banks()

    this.log(
      ttyTable(
        [
          {align: 'left', value: 'id'},
          {align: 'left', value: 'name'},
          {align: 'left', value: 'key'},
          {align: 'left', value: 'count'},
          {align: 'center', value: 'order'},
        ],
        banks.map((bank) => [bank.id, bank.name, bank.key, bank.count ?? '', bank.order]),
      ).render(),
    )
  }
}
