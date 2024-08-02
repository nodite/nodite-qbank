import {Args, Command, Flags} from '@oclif/core'
import inquirer from 'inquirer'

import VendorManager from '../../components/vendor/index.js'

export default class Login extends Command {
  static args = {
    vendor: Args.string({description: '题库供应商', options: VendorManager.getNames(), required: true}),
  }

  static description = 'Login to vendor'

  static examples = [
    `<%= config.bin %> <%= command.id %>
Login to vendor (./src/commands/vendor/login.ts)
`,
  ]

  static flags = {
    password: Flags.string({char: 'p', default: '', description: '密码'}),
    username: Flags.string({char: 'n', default: '', description: '用户名/邮箱/手机号'}),
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
    const Vendor = VendorManager.getClass(args.vendor)
    const vendor = new Vendor()

    const config = await vendor.login(flags.username, flags.password)

    this.log(`Login to ${args.vendor} successfully! (./src/commands/vendor/login.ts)`)
    this.log(`config: ${JSON.stringify(config, null, 2)}`)
  }
}
