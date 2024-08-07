import {Command, Flags} from '@oclif/core'
import inquirer from 'inquirer'
import lodash from 'lodash'
// @ts-expect-error because object-treeify v2 is not typed
import treeify from 'object-treeify'

import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'

export default class List extends Command {
  static args = {}

  static description = 'List categories'

  static example = [
    `<%= config.bin %> <%= command.id %>
List categories (./src/commands/category/list.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
    vendor: Flags.string({char: 'v', default: '', description: '题库供应商'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

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

    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // banks.
    const banks = await vendor.banks()

    const _banks =
      lodash.filter(
        banks,
        (bank: Bank) =>
          bank.id.toString().includes(flags.bank) || bank.name.includes(flags.bank) || bank.key.includes(flags.bank),
      ) || banks

    if (banks.length !== 1) {
      const questions = [
        {
          choices: lodash.map(_banks, 'name'),
          message: '题库:',
          name: 'bank',
          type: 'list',
        },
      ]

      const answers = await inquirer.prompt(questions as never)
      flags.bank = answers.bank
    }

    const bank = banks.find((bank) => bank.name === flags.bank) as Bank

    // categories.
    const categories = await vendor.categories(lodash.filter(bank.key.split('|')).pop() as string)

    const _convert = (cts: Category[]): unknown => {
      return lodash
        .chain(cts)
        .keyBy((ct) => `${ct.name} (${ct.id}, ${ct.count})`)
        .mapValues((ct) => (ct.children.length === 0 ? '' : _convert(ct.children)))
        .value()
    }

    this.log(treeify(_convert(categories), {separator: ''}))
  }
}
