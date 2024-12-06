import {Hook} from '@oclif/core'

import {service as embeddingService} from '../../embedding/service.js'
import puppeteer from '../../utils/puppeteer.js'

const postrun = async () => {
  // Close the browser
  await puppeteer.close()

  // Close the embedding service
  await embeddingService.close()

  // Run garbage collection
  if (global.gc) global.gc()
}

const hook: Hook.Postrun = async () => {
  await postrun()
}

export {postrun}
export default hook
