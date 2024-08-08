import {Hook} from '@oclif/core'
import lodash from 'lodash'

lodash.templateSettings.interpolate = /{{([\S\s]+?)}}/g

import '../../utils/event.js'

const hook: Hook.Init = async () => {
  // This hook is run before any command
}

export default hook
