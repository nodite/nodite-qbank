import {Hook} from '@oclif/core'
import lodash from 'lodash'

lodash.templateSettings.interpolate = /{{([\S\s]+?)}}/g

import '../../cache/index.js'
import '../../utils/event.js'
import '../../embedding/service.js'
import '../../env.js'

const hook: Hook.Init = async () => {
  // This hook is run before any command
}

export default hook
