import {Command, Flags} from '@oclif/core'
import inquirer from 'inquirer'
import lodash from 'lodash'

import VendorManager from './components/vendor/index.js'
import {Bank} from './types/bank.js'
import {find, findAll} from './utils/index.js'

export default abstract class BaseCommand extends Command {
  static baseFlags = {
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
    vendor: Flags.string({char: 'v', default: '', description: '题库供应商'}),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async ensureFlags<T extends {[name: string]: any}>(flags: T): Promise<void> {
    const questions = []

    if (!flags.vendor) {
      questions.push({choices: VendorManager.getVendorNames(), message: '题库供应商:', name: 'vendor', type: 'list'})
    }

    if (!flags.username) {
      questions.push({message: '用户名/邮箱/手机号:', name: 'username', type: 'input'})
    }

    if (questions.length > 0) {
      const answers = await inquirer.prompt(questions as never)
      Object.assign(flags, answers)
    }

    // vendor
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    // bank
    if (lodash.has(flags, 'bank')) {
      const banks = await vendor.banks()
      const _banks = findAll(banks, flags.bank) || banks

      if (_banks.length !== 1) {
        const answers = await inquirer.prompt([
          {
            choices: lodash.map(_banks, (bank) => ({name: bank.name, value: bank.name})),
            message: '题库:',
            name: 'bank',
            type: 'list',
          },
        ] as never)

        Object.assign(flags, answers)
      }

      // category
      if (lodash.has(flags, 'category') && flags.bank) {
        const bank = find<Bank>(banks, flags.bank) as Bank
        const categories = await vendor.categories(bank)
        const _categories = findAll(categories, flags.category, {excludeKey: ['children']}) || categories

        if (_categories.length !== 1) {
          const answers = await inquirer.prompt([
            {
              choices: lodash.map(_categories, (ct) => {
                const tags = [ct.fetch ? '[fetch]' : '', ct.convert ? '[convert]' : ''].join(' ')
                return {name: `${ct.name} ${tags}`, value: ct.name}
              }),
              message: '分类:',
              name: 'category',
              type: 'list',
            },
          ] as never)

          Object.assign(flags, answers)
        }
      }
    }
  }
}
