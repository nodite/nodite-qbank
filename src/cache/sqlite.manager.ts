import path from 'node:path'

import {SqliteStore, sqliteStore} from '@resolid/cache-manager-sqlite'
import {useAdapter} from '@type-cacheable/cache-manager-adapter'
import typeCacheableManager, {CacheManagerOptions as TypeCacheManagerOptions} from '@type-cacheable/core'
import * as cacheManager from 'cache-manager'

import {CLI_ASSETS_DIR} from '../env.js'
import memory from './memory.manager.js'

// Set cacheable manager options
typeCacheableManager.default.setOptions(<TypeCacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

type InitStoreReturn = {cache: cacheManager.Cache; store: SqliteStore}

const initStore = async (vendorName: string): Promise<InitStoreReturn> => {
  const _existStore = await memory.cache.get<InitStoreReturn>(`sqlite:store:${vendorName}`)

  if (_existStore) return _existStore

  const store = sqliteStore({
    cacheTableName: 'qbank_' + vendorName.replaceAll('-', '_'),
    enableWALMode: true,
    sqliteFile: path.join(CLI_ASSETS_DIR, 'cache.sqlite3'),
  })

  // VACUUM the database to shrink the file size
  store.client.pragma('auto_vacuum = FULL')
  // ANALYZE the caches database
  store.client.pragma('analysis_limit = 1000')
  // Set synchronous to NORMAL
  store.client.pragma('synchronous = NORMAL')
  // optimize the database
  store.client.pragma('optimize = 0x10002')

  const cache = cacheManager.createCache(store)

  await memory.cache.set(`sqlite:store:${vendorName}`, {cache, store})

  return {cache, store}
}

const switchClient = async (vendorName: string) => {
  const {cache, store} = await initStore(vendorName)

  typeCacheableManager.default.setClient(useAdapter(cache))
  typeCacheableManager.default.setFallbackClient(useAdapter(cache))

  return {cache, store}
}

const commonStore = await initStore('_common')

const CommonClient = useAdapter(commonStore.cache) as typeCacheableManager.CacheClient

export default {CommonClient, initStore, switchClient}
