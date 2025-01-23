import {Hook} from '@oclif/core'

import cacheManager from '../../cache/cache.manager.js'
import {service as embeddingService} from '../../embedding/service.js'
import puppeteer from '../../utils/puppeteer.js'

const hook: Hook.Finally = async () => {
  // Close the browser
  await puppeteer.close()

  // Close the embedding service
  await embeddingService.close()

  // Close the cache store
  await cacheManager.close()

  // Run garbage collection
  if (global.gc) global.gc()
}

export default hook
