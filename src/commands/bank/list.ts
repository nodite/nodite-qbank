import {Command, Flags} from '@oclif/core'
import {CacheClear} from '@type-cacheable/core'
import inquirer from 'inquirer'
import ttyTable from 'tty-table'

import VendorManager from '../../components/vendor/index.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from '../../components/vendor/main.js'

export default class List extends Command {
  static args = {}

  static description = 'List banks'

  static example = [
    `<%= config.bin %> <%= command.id %>
List banks (./src/commands/course/list.ts)
`,
  ]

  static flags = {
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
    vendor: Flags.string({char: 'v', default: '', description: '题库供应商'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

    // Ensure vendor and username are provided
    const questions = []

    if (!flags.vendor) {
      questions.push({choices: VendorManager.getVendorNames(), message: '题库供应商:', name: 'vendor', type: 'list'})
    }

    if (!flags.username) {
      questions.push({message: '用户名/邮箱/手机号:', name: 'username', type: 'input'})
    }

    if (questions.length > 0) {
      const answers = await inquirer.prompt(questions as never)
      flags.vendor = flags.vendor || answers.vendor
      flags.username = flags.username || answers.username
    }

    // List banks
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    if (flags.invalidate) await this._invalidate(vendor)

    const banks = await vendor.banks()

    this.log(
      ttyTable(
        [
          {align: 'left', value: 'id'},
          {align: 'left', value: 'name'},
          {align: 'left', value: 'key'},
        ],
        banks.map((bank) => [bank.id, bank.name, bank.key]),
      ).render(),
    )
  }

  @CacheClear({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.BANKS)})
  async _invalidate(_: Vendor): Promise<void> {}
}
