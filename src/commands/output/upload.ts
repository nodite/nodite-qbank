import {Flags} from '@oclif/core'
import {Presets, SingleBar} from 'cli-progress'

import BaseCommand from '../../base.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {Sheet} from '../../types/sheet.js'
import {emitter} from '../../utils/event.js'
import {find} from '../../utils/index.js'

export default class Upload extends BaseCommand {
  static args = {}

  static description = 'Upload questions'

  static example = [
    `<%= config.bin %> <%= command.id %>
Upload questions (./src/commands/output/upload.ts)
`,
  ]

  static flags = {
    bank: Flags.string({char: 'b', default: '', description: '题库ID/名称/Key'}),
    category: Flags.string({char: 'c', default: '', description: '分类ID/名称'}),
    output: Flags.string({char: 'o', default: '', description: '接收方'}),
    output_username: Flags.string({default: '', description: '接收方用户名'}),
    sheet: Flags.string({char: 's', default: '', description: '试卷ID/名称'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upload)

    await this.ensureFlags(flags)

    // vendor.
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // output.
    const output = new vendor.allowedOutputs[flags.output](flags.username, flags.output_username)

    // bank.
    const banks = await vendor.banks()
    const bank = find<Bank>(banks, flags.bank) as Bank

    // category.
    const categories = await vendor.categories(bank)
    const category = find<Category>(categories, flags.category, {excludeKey: ['children']}) as Category

    // sheet.
    const sheets = await vendor.sheets(bank, category)
    const sheet = find<Sheet>(sheets, flags.sheet) as Sheet

    // processing.
    const bar = new SingleBar({}, Presets.rect)

    bar.start(sheet.count || 1, 0)

    // upload.
    output.upload({bank, category, sheet, vendor}, {reupload: flags.clean})

    for await (const data of emitter.listener('output.upload.count')) {
      bar.update(data as number)
    }

    bar.stop()
  }
}
