import path from 'node:path'

import {useAdapter} from '@oscaner/cache-manager-adapter'
import {KeyvSqlite} from '@resolid/keyv-sqlite'
import cacheManager, {CacheManagerOptions} from '@type-cacheable/core'
import {createCache} from 'cache-manager'
import {Keyv} from 'keyv'

import {CLI_ASSETS_DIR} from '../env.js'
import memory from './memory.manager.js'

type CacheReturn = {cache: ReturnType<typeof createCache>; keyv: Keyv; store: KeyvSqlite}

cacheManager.default.setOptions(<CacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

/**
 * Initialize SQLite store
 */
const initStore = async (vendor: string): Promise<CacheReturn> => {
  const _existStore = await memory.cache.get<CacheReturn>(`sqlite:store:${vendor}`)

  if (_existStore) return _existStore

  const store = new KeyvSqlite({
    enableWALMode: true,
    iterationLimit: 5000,
    table: 'qbank_' + vendor.replaceAll('-', '_'),
    uri: path.join(CLI_ASSETS_DIR, 'cache.sqlite3'),
  })

  // VACUUM the database to shrink the file size
  store.sqlite.pragma('auto_vacuum = FULL')
  // ANALYZE the caches database
  store.sqlite.pragma('analysis_limit = 1000')
  // Set synchronous to NORMAL
  store.sqlite.pragma('synchronous = NORMAL')
  // optimize the database
  store.sqlite.pragma('optimize = 0x10002')

  const keyv = new Keyv({
    namespace: vendor,
    store,
    ttl: cacheManager.default.options.ttlSeconds,
    useKeyPrefix: false,
  })

  const cache = createCache({stores: [keyv]})

  const _return = {cache, keyv, store}

  await memory.cache.set(`sqlite:store:${vendor}`, _return)

  return _return
}

const switchClient = async (vendor: string): Promise<CacheReturn> => {
  const {cache, keyv, store} = await initStore(vendor)

  const adapter = useAdapter(cache, [keyv as never])

  cacheManager.default.setClient(adapter)
  cacheManager.default.setFallbackClient(adapter)

  return {cache, keyv, store}
}

const commonStore = await initStore('_common')

const CommonClient = useAdapter(commonStore.cache, [commonStore.keyv as never])

export default {CommonClient, initStore, switchClient}
