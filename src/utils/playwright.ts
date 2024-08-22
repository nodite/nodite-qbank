import lodash from 'lodash'
import md5 from 'md5'
import * as playwright from 'playwright'

import memory from '../cache/memory.manager.js'

/**
 * Browser.
 */
const browser = async (create: boolean = true) => {
  const cacheKey = 'playwright:browser'

  let _browser = await memory.cache.get<playwright.Browser>(cacheKey)

  if ((!_browser || !_browser.isConnected()) && create) {
    _browser = await playwright.webkit.launch()
    await memory.cache.set(cacheKey, _browser)
  }

  return _browser
}

/**
 * Context.
 */
const context = async (name: string) => {
  const cacheKey = `playwright:context:${name}`

  let _context = await memory.cache.get<playwright.BrowserContext>(cacheKey)

  if (!_context) {
    const _browser = (await browser()) as playwright.Browser
    _context = await _browser.newContext()
    await memory.cache.set(cacheKey, _context)
  }

  return _context
}

/**
 * Page.
 */
const page = async (name: string, url: string) => {
  const contextCacheKey = `playwright:context:${name}`
  const _context = await context(contextCacheKey)

  const pageCacheKey = `playwright:context:${name}:page:${md5(url)}`
  let _page = await memory.cache.get<playwright.Page>(pageCacheKey)

  if (!_page || _page.isClosed()) {
    _page = await _context.newPage()
    await _page.goto(url)
    await memory.cache.set(pageCacheKey, _page)
  }

  return _page
}

const close = async () => {
  const _browser = await browser(false)
  await _browser?.close()

  const cacheKeys = await memory.cache.store.keys('playwright:*')
  await Promise.all(lodash.map(cacheKeys, memory.cache.del))
}

export default {browser, close, context, page}
