import {Hook} from '@oclif/core'

import puppeteer from '../../utils/puppeteer.js'

const hook: Hook.Postrun = async () => {
  // This hook is run after a command
  await puppeteer.close()
}

export default hook
