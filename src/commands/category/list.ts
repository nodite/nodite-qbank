import {Flags} from '@oclif/core'
import lodash from 'lodash'
// @ts-expect-error because object-treeify v2 is not typed
import treeify from 'object-treeify'

import BaseCommand from '../../base.js'
import {HashKeyScope} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {find} from '../../utils/index.js'

export default class List extends BaseCommand {
  static args = {}

  static description = 'List categories'

  static example = [
    `<%= config.bin %> <%= command.id %>
List categories (./src/commands/category/list.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    rich: Flags.boolean({default: false, description: '详细信息'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank.
    const banks = await vendor.banks()
    const bank = find<Bank>(banks, flags.bank) as Bank

    // no '*' bank.
    if (bank.id !== '*') {
      // categories.
      if (flags.clean) await vendor.invalidate(HashKeyScope.CATEGORIES, bank)

      const categories = await vendor.categories(bank)

      const _convert = (cts: Category[]): unknown => {
        return lodash
          .chain(cts)
          .keyBy((ct) => `${ct.name} [${ct.id}, ${ct.count}]`)
          .mapValues((ct) => (ct.children.length === 0 || !flags.rich ? '' : _convert(ct.children)))
          .value()
      }

      this.log('\n' + treeify(_convert(categories), {separator: ''}))

      return
    }

    // '*' bank.
    for (const _bank of await vendor.banks({excludeTtl: true})) {
      this.log('\n---\n')

      const _argv = ['--vendor', flags.vendor, '--username', flags.username, '--bank', _bank.name]

      if (flags.clean) {
        _argv.push('--clean')
      }

      if (flags.rich) {
        _argv.push('--rich')
      }

      this.log('*(category:list)')
      await this.config.runCommand('category:list', _argv)
    }
  }
}
