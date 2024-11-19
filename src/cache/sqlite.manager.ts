import {SqliteStore, sqliteStore} from '@resolid/cache-manager-sqlite'
import {useAdapter} from '@type-cacheable/cache-manager-adapter'
import typeCacheableManager, {CacheManagerOptions as TypeCacheManagerOptions} from '@type-cacheable/core'
import * as cacheManager from 'cache-manager'
import lodash from 'lodash'
import path from 'node:path'

import vendor from '../components/vendor/_/index.js'
import {CLI_ASSETS_DIR} from '../env.js'

// Set cacheable manager options
typeCacheableManager.default.setOptions(<TypeCacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

const stories = {} as Record<string, {cache: cacheManager.Cache; store: SqliteStore}>

for (const vendorName of [...vendor.list(), '_common']) {
  // On disk cache on caches table sync version
  const store = sqliteStore({
    cacheTableName: 'qbank_' + vendorName.replaceAll('-', '_'),
    enableWALMode: true,
    sqliteFile: path.join(CLI_ASSETS_DIR, 'cache.sqlite3'),
  })

  // VACUUM the database to shrink the file size
  store.client.pragma('auto_vacuum = FULL')
  // ANALYZE the caches database
  store.client.pragma('analyze')
  // Set synchronous to FULL
  store.client.pragma('synchronous = FULL')

  const cache = cacheManager.createCache(store)

  stories[vendorName] = {cache, store}
}

const switchClient = (vendorName: string) => {
  if (!lodash.has(stories, vendorName)) {
    throw new Error(`The store of Vendor ${vendorName} not found`)
  }

  const {cache, store} = stories[vendorName]

  typeCacheableManager.default.setClient(useAdapter(cache))
  typeCacheableManager.default.setFallbackClient(useAdapter(cache))

  return {cache, store}
}

const CommonClient = useAdapter(stories._common.cache) as typeCacheableManager.CacheClient

export default {CommonClient, stories, switchClient}
