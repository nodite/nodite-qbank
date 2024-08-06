import {Args, Command, Flags} from '@oclif/core'
import {CacheClear} from '@type-cacheable/core'
import inquirer from 'inquirer'

import VendorManager from '../../components/vendor/index.js'
import {HashKeyScope, Vendor, cacheKeyBuilder, hashKeyBuilder} from '../../components/vendor/main.js'

export default class Login extends Command {
  static args = {
    vendor: Args.string({description: '题库供应商', options: VendorManager.getVendorNames(), required: true}),
  }

  static description = 'Login to vendor'

  static examples = [
    `<%= config.bin %> <%= command.id %>
Login to vendor (./src/commands/vendor/login.ts)
`,
  ]

  static flags = {
    invalidate: Flags.boolean({char: 'i', default: false, description: '清除缓存'}),
    password: Flags.string({char: 'p', default: '', description: '密码'}),
    username: Flags.string({char: 'u', default: '', description: '用户名/邮箱/手机号'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Login)

    // Ensure username and password are provided
    const questions = []

    if (!flags.username) {
      questions.push({message: '用户名/邮箱/手机号:', name: 'username', type: 'input'})
    }

    if (!flags.password) {
      questions.push({message: '密码:', name: 'password', type: 'password'})
    }

    if (questions.length > 0) {
      const answers = await inquirer.prompt(questions as never)
      flags.username = flags.username || answers.username
      flags.password = flags.password || answers.password
    }

    // Login to vendor
    const vendor = new (VendorManager.getClass(args.vendor))(flags.username)

    if (flags.invalidate) await this._invalidate(vendor)

    const config = await vendor.login(flags.password)

    this.log(`Login to ${args.vendor} successfully! (./src/commands/vendor/login.ts)`)
    this.log(`config: ${JSON.stringify(config, null, 2)}`)
  }

  @CacheClear({cacheKey: cacheKeyBuilder(), hashKey: hashKeyBuilder(HashKeyScope.LOGIN)})
  async _invalidate(_: Vendor): Promise<void> {}
}
