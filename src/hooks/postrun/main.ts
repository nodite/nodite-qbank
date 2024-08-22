import {Hook} from '@oclif/core'

import playwright from '../../utils/playwright.js'

const hook: Hook.Postrun = async () => {
  // This hook is run after a command
  await playwright.close()
}

export default hook
