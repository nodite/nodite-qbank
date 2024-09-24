import {Command} from '@oclif/core'
import TtyTable from 'tty-table'

import VendorManager from '../../components/vendor/index.js'

export default class List extends Command {
  static args = {}

  static description = '题库供应商列表'

  static example = [
    `<%= config.bin %> <%= command.id %>
List vendors (./src/commands/vendor/list.ts)
`,
  ]

  static flags = {}

  async run(): Promise<void> {
    const metas = VendorManager.getMetas()

    this.log(
      TtyTable(
        [
          {align: 'left', value: 'key'},
          {align: 'left', value: 'name'},
        ],
        metas.map((meta) => [meta.key, meta.name]),
      ).render(),
    )
  }
}
