import lodash from 'lodash'
import md5 from 'md5'
import * as playwright from 'playwright'
import UserAgent from 'user-agents'

import memory from '../cache/memory.manager.js'

/**
 * Browser.
 */
const browser = async (create: boolean = true) => {
  const cacheKey = 'playwright:browser'

  let _browser = await memory.cache.get<playwright.Browser>(cacheKey)

  if ((!_browser || !_browser.isConnected()) && create) {
    _browser = await playwright.chromium.launch({headless: true})
    await memory.cache.set(cacheKey, _browser)
  }

  return _browser
}

/**
 * Page.
 */
const page = async (name: string, url: string) => {
  const pageCacheKey = `playwright:page:${md5(url)}`
  let _page = await memory.cache.get<playwright.Page>(pageCacheKey)

  if (!_page || _page.isClosed()) {
    const userAgent = new UserAgent({
      deviceCategory: 'mobile',
      platform: 'iPhone',
    }).toString()

    _page = await (await browser())?.newPage({userAgent})

    await _page?.goto(url, {waitUntil: 'networkidle'})
    await memory.cache.set(pageCacheKey, _page)
  }

  if (!_page) {
    throw new Error('Page not found')
  }

  return _page
}

const close = async () => {
  const _browser = await browser(false)
  await _browser?.close()

  const cacheKeys = await memory.cache.store.keys('playwright:*')
  await Promise.all(lodash.map(cacheKeys, memory.cache.del))
}

export default {browser, close, page}
