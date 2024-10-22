import {input, select} from '@inquirer/prompts'
import {Command, Flags} from '@oclif/core'
import colors from 'ansi-colors'
import lodash from 'lodash'

import sqliteCache from './cache/sqlite.manager.js'
import OutputManager from './components/output/index.js'
import VendorManager from './components/vendor/index.js'
import {Bank} from './types/bank.js'
import {Category} from './types/category.js'
import {fiindAll, find} from './utils/index.js'

export default abstract class BaseCommand extends Command {
  static baseFlags = {
    clean: Flags.boolean({char: 'r', default: false, description: '清除缓存'}),
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
    vendor: Flags.string({char: 'v', default: '', description: '题库供应商'}),
  }

  /**
   * Ensure flags.
   */
  protected async ensureFlags<T extends {[name: string]: any}>(flags: T): Promise<void> {
    if (flags.vendor) {
      console.log(`${colors.green('✔')} ${colors.bold('题库供应商')}: ${colors.cyan(flags.vendor)}`)
    } else {
      Object.assign(flags, {
        vendor: await select({
          choices: lodash.map(VendorManager.getMetas(), (meta) => ({
            name: `${meta.name} (${meta.key})`,
            value: meta.key,
          })),
          message: '题库供应商:',
        }),
      })
    }

    // switch cache client
    sqliteCache.switchClient(flags.vendor)

    if (flags.username) {
      console.log(`${colors.green('✔')} ${colors.bold('供应商账号')}: ${colors.cyan(flags.username)}`)
    } else {
      Object.assign(flags, {username: await input({message: '供应商账号:'})})
    }

    // bank
    if (lodash.has(flags, 'bank')) {
      await this._ensureBank(flags)
    }

    // category
    if (lodash.has(flags, 'category')) {
      await this._ensureCategory(flags)
    }

    // sheet
    if (lodash.has(flags, 'sheet')) {
      await this._ensureSheet(flags)
    }

    // output
    if (lodash.has(flags, 'output')) {
      await this._ensureOutput(flags)
    }
  }

  /**
   * Ensure bank.
   */
  protected async _ensureBank(flags: any): Promise<void> {
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const banks = await vendor.banks()

    const _banks = fiindAll(banks, [flags.bank as string], {fuzzy: true})

    if (lodash.isEmpty(_banks)) _banks.push(...banks)

    if (_banks.length === 1) {
      flags.bank = _banks[0].name as any
      console.log(`${colors.green('✔')} ${colors.bold('题库')}: ${colors.cyan(_banks[0].name)}`)
      return
    }

    Object.assign(flags, {
      bank: await select({
        choices: lodash.map(_banks, (bank) => ({name: bank.name, value: bank.name})),
        message: '题库:',
      }),
    })
  }

  /**
   * Ensure category.
   */
  protected async _ensureCategory(flags: any): Promise<void> {
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const bank = find(await vendor.banks(), flags.bank) as Bank

    if (bank.id === '*') {
      console.log(`${colors.yellow('⚠')} ${colors.bold('分类')}: ${colors.yellow('题库为 "*" 时无法选择')}`)
      throw new Error()
    }

    const categories = await vendor.categories({bank})

    const _categories = fiindAll(categories, [flags.category as string], {excludeKey: ['children'], fuzzy: true})

    if (lodash.isEmpty(_categories)) _categories.push(...categories)

    if (_categories.length === 1) {
      flags.category = _categories[0].name as any
      console.log(`${colors.green('✔')} ${colors.bold('分类')}: ${colors.cyan(_categories[0].name)}`)
      return
    }

    Object.assign(flags, {
      category: await select({
        choices: lodash.map(_categories, (ct) => ({name: ct.name, value: ct.name})),
        message: '分类:',
      }),
    })
  }

  /**
   * Ensure output.
   */
  protected async _ensureOutput(flags: any): Promise<void> {
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const outputs = OutputManager.getMetas(Object.values(vendor.allowedOutputs))

    const _outputs = fiindAll(outputs, [flags.output as string], {fuzzy: true})

    if (lodash.isEmpty(_outputs)) _outputs.push(...outputs)

    // output
    if (_outputs.length === 1) {
      flags.output = _outputs[0].key as any
      console.log(`${colors.green('✔')} ${colors.bold('接收方')}: ${colors.cyan(_outputs[0].name)}`)
    }
    // multiple outputs.
    else {
      Object.assign(flags, {
        output: await select({
          choices: lodash.map(_outputs, (output) => ({name: output.name, value: output.key})),
          message: '接收方:',
        }),
      })
    }

    // output username
    if (flags['output-username']) {
      flags['output-username'] = flags['output-username'].toString()
      console.log(`${colors.green('✔')} ${colors.bold('接收方账号')}: ${colors.cyan(flags['output-username'])}`)
    }
    // input output username.
    else {
      Object.assign(flags, {
        'output-username': await input({default: flags.username, message: '接收方账号:'}),
      })
    }
  }

  /**
   * Ensure sheet.
   */
  protected async _ensureSheet(flags: any): Promise<void> {
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const bank = find(await vendor.banks(), flags.bank) as Bank

    const category = find(await vendor.categories({bank}), flags.category, {excludeKey: ['children']}) as Category

    if (category.id === '*') {
      console.log(`${colors.yellow('⚠')} ${colors.bold('试卷')}: ${colors.yellow('分类为 "*" 时无法选择')}`)
      throw new Error()
    }

    const sheets = await vendor.sheets({bank, category})

    const _sheets = fiindAll(sheets, [flags.sheet as string], {fuzzy: true})

    if (lodash.isEmpty(_sheets)) _sheets.push(...sheets)

    if (_sheets.length === 1) {
      flags.sheet = _sheets[0].name as any
      console.log(`${colors.green('✔')} ${colors.bold('试卷')}: ${colors.cyan(_sheets[0].name)}`)
      return
    }

    Object.assign(flags, {
      sheet: await select({
        choices: lodash.map(_sheets, (sheet) => ({name: sheet.name, value: sheet.name})),
        message: '试卷:',
      }),
    })
  }
}
