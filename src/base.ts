import {Command, Flags} from '@oclif/core'
import inquirer from 'inquirer'
import lodash from 'lodash'

import OutputManager from './components/output/index.js'
import VendorManager from './components/vendor/index.js'
import {Bank} from './types/bank.js'
import {Category} from './types/category.js'
import {find, findAll} from './utils/index.js'

export default abstract class BaseCommand extends Command {
  static baseFlags = {
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
    vendor: Flags.string({char: 'v', default: '', description: '题库供应商'}),
  }

  /**
   * Ensure flags.
   */
  protected async ensureFlags<T extends {[name: string]: any}>(flags: T): Promise<void> {
    const questions = []

    if (!flags.vendor) {
      questions.push({
        choices: lodash.map(VendorManager.getMetas(), (meta) => ({name: meta.name, value: meta.key})),
        message: '题库供应商:',
        name: 'vendor',
        type: 'list',
      })
    }

    if (!flags.username) {
      questions.push({message: '用户名/邮箱/手机号:', name: 'username', type: 'input'})
    }

    if (questions.length > 0) {
      const answers = await inquirer.prompt(questions as never)
      Object.assign(flags, answers)
    }

    // bank
    await this._ensureBank<T>(flags)

    // category
    await this._ensureCategory<T>(flags)

    // sheet
    await this._ensureSheet<T>(flags)

    // output
    await this._ensureOutput<T>(flags)
  }

  /**
   * Ensure bank.
   */
  protected async _ensureBank<T extends {[name: string]: any}>(flags: T): Promise<void> {
    if (!lodash.has(flags, 'bank')) return

    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const banks = await vendor.banks()
    const _banks = findAll(banks, flags.bank) || banks

    if (_banks.length === 1 && flags.bank) return

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

  /**
   * Ensure category.
   */
  protected async _ensureCategory<T extends {[name: string]: any}>(flags: T): Promise<void> {
    if (!lodash.has(flags, 'category') || !flags.bank) return

    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const bank = find<Bank>(await vendor.banks(), flags.bank) as Bank

    const categories = await vendor.categories(bank)

    const _categories = findAll(categories, flags.category, {excludeKey: ['children']}) || categories

    if (_categories.length === 1 && flags.category) return

    const answers = await inquirer.prompt([
      {
        choices: lodash.map(_categories, (ct) => ({name: ct.name, value: ct.name})),
        message: '分类:',
        name: 'category',
        type: 'list',
      },
    ] as never)

    Object.assign(flags, answers)
  }

  /**
   * Ensure output.
   */
  protected async _ensureOutput<T extends {[name: string]: any}>(flags: T): Promise<void> {
    if (!lodash.has(flags, 'output')) return

    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const outputs = OutputManager.getMetas(Object.values(vendor.allowedOutputs))

    const _outputs = findAll(outputs, flags.output) || outputs

    const questions = []

    if (_outputs.length !== 1 || !flags.output) {
      questions.push({
        choices: lodash.map(_outputs, (output) => ({name: output.name, value: output.key})),
        message: '接收方:',
        name: 'output',
        type: 'list',
      })
    }

    if (!flags.outputUsername) {
      questions.push({
        default: flags.username,
        message: '接收方用户名:',
        name: 'outputUsername',
        type: 'input',
      })
    }

    const answers = await inquirer.prompt(questions as never)

    Object.assign(flags, answers)
  }

  /**
   * Ensure sheet.
   */
  protected async _ensureSheet<T extends {[name: string]: any}>(flags: T): Promise<void> {
    if (!lodash.has(flags, 'sheet') || !flags.category) return

    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const bank = find<Bank>(await vendor.banks(), flags.bank) as Bank

    const category = find<Category>(await vendor.categories(bank), flags.category) as Category

    const sheets = await vendor.sheets(bank, category)

    const _sheets = findAll(sheets, flags.sheet) || sheets

    if (_sheets.length === 1 && flags.sheet) return

    const answers = await inquirer.prompt([
      {
        choices: lodash.map(_sheets, (sheet) => ({name: sheet.name, value: sheet.name})),
        message: '试卷:',
        name: 'sheet',
        type: 'list',
      },
    ] as never)

    Object.assign(flags, answers)
  }
}
