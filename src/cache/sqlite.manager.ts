import {sqliteStore} from '@resolid/cache-manager-sqlite'
import {useAdapter} from '@type-cacheable/cache-manager-adapter'
import typeCacheableManager, {CacheManagerOptions as TypeCacheManagerOptions} from '@type-cacheable/core'
import * as cacheManager from 'cache-manager'
import path from 'node:path'

import {CLI_ASSETS_DIR} from '../env.js'

// On disk cache on caches table sync version
const store = sqliteStore({
  cacheTableName: 'caches',
  sqliteFile: path.join(CLI_ASSETS_DIR, 'cache.sqlite3'),
})

const cache = cacheManager.createCache(store)

// Set cacheable manager options
typeCacheableManager.default.setOptions(<TypeCacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

typeCacheableManager.default.setClient(useAdapter(cache))

export default {cache, store}
