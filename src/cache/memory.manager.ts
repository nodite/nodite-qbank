import {createCache} from 'cache-manager'
import {KeyvCacheableMemory} from 'cacheable'
import {Keyv} from 'keyv'

const store = new KeyvCacheableMemory({lruSize: 5000, ttl: '1h', useClone: false})
const keyv = new Keyv({deserialize: undefined, namespace: '', serialize: undefined, store, useKeyPrefix: false})
const cache = createCache({stores: [keyv]})

export default {cache, store: store.store}
