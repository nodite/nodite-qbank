import {password} from '@inquirer/prompts'
import {Flags} from '@oclif/core'

import BaseCommand from '../../base.js'
import VendorManager from '../../components/vendor/index.js'

export default class Login extends BaseCommand {
  static description = '登录供应商'

  static examples = [
    `<%= config.bin %> <%= command.id %>
Login to vendor (./src/commands/vendor/login.ts)
`,
  ]

  static flags = {
    password: Flags.string({char: 'p', default: '', description: '密码'}),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Login)

    await this.ensureFlags(flags)

    // Ensure password are provided
    if (!flags.password) {
      Object.assign(flags, {
        password: await password({message: '密码:'}),
      })
    }

    // Login to vendor
    const vendor = new (VendorManager.getClass(flags.vendor))(flags.username)

    const config = await vendor.login({clean: flags.clean, password: flags.password})

    this.log(`Login to ${flags.vendor} successfully! (./src/commands/vendor/login.ts)`)
    this.log(`config: ${JSON.stringify(config, null, 2)}`)
  }
}
