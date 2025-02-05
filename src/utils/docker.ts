import * as compose from 'docker-compose'
import lodash from 'lodash'

import {PKG_ROOT_DIR} from '../env.js'

const host = async () => {
  const result = await compose.ps({commandOptions: [['--format', 'json']], cwd: PKG_ROOT_DIR})
  const service = lodash.find(result.data.services, {name: 'qbank-cache', state: 'running'})

  if (!service) {
    throw new Error('qbank-cache service not found')
  }

  const port = lodash.find(service.ports, (port) => port.mapped?.address === '0.0.0.0')!

  return `${port.mapped?.address}:${port.mapped?.port}`
}

export default {host}
