import {caching} from 'cache-manager'

const cache = await caching('memory', {
  shouldCloneBeforeSet: false,
  ttl: 0,
})

export default {cache}
