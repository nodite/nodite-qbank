import {exit} from 'node:process'

import {KeyvPostgres} from '@keyv/postgres'
import {useAdapter} from '@oscaner/cache-manager-adapter'
import cacheManager, {CacheManagerOptions} from '@type-cacheable/core'
import {createCache} from 'cache-manager'
import {Keyv} from 'keyv'
import lodash from 'lodash'

import vendors from '../components/vendor/_/index.js'
import docker from '../utils/docker.js'
import memory from './memory.manager.js'

const cacheHost = await docker.host()

type CacheReturn = {cache: ReturnType<typeof createCache>; keyv: Keyv; store: KeyvPostgres}

cacheManager.default.setOptions(<CacheManagerOptions>{
  debug: true,
  excludeContext: false,
  ttlSeconds: 0,
})

/**
 * Initialize cache store
 */
const initStore = async (vendor: string): Promise<CacheReturn> => {
  if (!vendors.list().includes(vendor) && vendor !== '_common') {
    console.error(`Unknown vendor: ${vendor}`)
    exit(1)
  }

  const _existStore = await memory.cache.get<CacheReturn>(`cache:store:${vendor}`)

  if (_existStore) return _existStore

  const store = new KeyvPostgres({
    iterationLimit: 5000,
    table: 'qbank_' + vendor.replaceAll('-', '_'),
    uri: `postgres://qbank:qbank@${cacheHost}/qbank`,
  })

  const keyv = new Keyv({
    namespace: vendor,
    store,
    ttl: cacheManager.default.options.ttlSeconds,
    useKeyPrefix: false,
  })

  const cache = createCache({stores: [keyv]})

  const _return = {cache, keyv, store}

  await memory.cache.set(`cache:store:${vendor}`, _return)

  return _return
}

const switchClient = async (vendor: string): Promise<CacheReturn> => {
  const {cache, keyv, store} = await initStore(vendor)

  const adapter = useAdapter(cache as never, [keyv as never])

  cacheManager.default.setClient(adapter)
  cacheManager.default.setFallbackClient(adapter)

  return {cache, keyv, store}
}

const close = async (): Promise<void> => {
  await Promise.all(
    lodash
      .chain([...memory.store.keys])
      .filter((key) => String(key).startsWith('cache:store:'))
      .map(async (key) => {
        const {store} = (await memory.cache.get<CacheReturn>(key)) as CacheReturn
        await store.disconnect()
        await memory.cache.del(key)
      })
      .value(),
  )
}

const CommonStore = await initStore('_common')

const CommonClient = useAdapter(CommonStore.cache as never, [CommonStore.keyv as never])

export default {close, CommonClient, CommonStore, initStore, switchClient}
