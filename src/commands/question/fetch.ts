import {Flags} from '@oclif/core'
import {Presets, SingleBar} from 'cli-progress'

import BaseCommand from '../../base.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {emitter} from '../../utils/event.js'
import {find} from '../../utils/index.js'

export default class Fetch extends BaseCommand {
  static args = {}

  static description = 'Fetch questions'

  static example = [
    `<%= config.bin %> <%= command.id %>
Fetch questions (./src/commands/question/fetch.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    category: Flags.string({char: 'c', default: '', description: '分类ID/名称'}),
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Fetch)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank.
    const banks = await vendor.banks()
    const bank = find<Bank>(banks, flags.bank) as Bank

    // category.
    const categories = await vendor.categories(bank)
    const category = find<Category>(categories, flags.category, {excludeKey: ['children']}) as Category

    // questions.
    vendor.fetchOriginQuestions(bank, category)

    // processing.
    const bar = new SingleBar({}, Presets.rect)

    bar.start(category.count, 0)

    for await (const data of emitter.listener('count')) {
      bar.update(data as number)
    }

    bar.stop()
  }
}
