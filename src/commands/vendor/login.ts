import {Flags} from '@oclif/core'
import inquirer from 'inquirer'

import BaseCommand from '../../base.js'
import {HashKeyScope} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'

export default class Login extends BaseCommand {
  static description = 'Login to vendor'

  static examples = [
    `<%= config.bin %> <%= command.id %>
Login to vendor (./src/commands/vendor/login.ts)
`,
  ]

  static flags = {
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
    password: Flags.string({char: 'p', default: '', description: '密码'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)

    await this.ensureFlags(flags)

    // Ensure password are provided
    if (!flags.password) {
      const answers = await inquirer.prompt([{message: '密码:', name: 'password', type: 'password'}] as never)
      Object.assign(flags, answers)
    }

    // Login to vendor
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    if (flags.invalidate) await vendor.invalidate(HashKeyScope.LOGIN)

    const config = await vendor.login(flags.password)

    this.log(`Login to ${flags.vendor} successfully! (./src/commands/vendor/login.ts)`)
    this.log(`config: ${JSON.stringify(config, null, 2)}`)
  }
}
