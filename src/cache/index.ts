import {useAdapter} from '@type-cacheable/cache-manager-adapter'
import cacheableManager, {CacheManagerOptions} from '@type-cacheable/core'

import {cache} from './sqlite.manager.js'

cacheableManager.default.setOptions(<CacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

cacheableManager.default.setClient(useAdapter(cache))
