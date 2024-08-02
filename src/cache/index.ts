import cacheableManager, {CacheManagerOptions} from '@type-cacheable/core'

import {useAdapter} from './sqlite/sqlite.adapter.js'
import {cache} from './sqlite/sqlite.manager.js'

cacheableManager.default.setOptions(<CacheManagerOptions>{
  excludeContext: false,
  ttlSeconds: 0,
})

cacheableManager.default.setClient(useAdapter(cache))
