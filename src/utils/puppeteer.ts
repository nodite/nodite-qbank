import lodash from 'lodash'
import md5 from 'md5'
import * as puppeteer from 'puppeteer'

import memory from '../cache/memory.manager.js'

/**
 * Browser.
 */
const browser = async (create: boolean = true) => {
  const cacheKey = 'puppeteer:browser'

  let _browser = await memory.cache.get<puppeteer.Browser>(cacheKey)

  if ((!_browser || !_browser.connected) && create) {
    _browser = await puppeteer.launch({headless: true})
    await memory.cache.set(cacheKey, _browser)
  }

  return _browser
}

/**
 * Page.
 */
const page = async (name: string, url: string, params?: {cookies?: puppeteer.CookieParam[]}) => {
  const pageCacheKey = `puppeteer:page:${md5(url)}`
  let _page = await memory.cache.get<puppeteer.Page>(pageCacheKey)

  if (!_page || _page.isClosed()) {
    const userAgent =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'

    _page = await (await browser())?.newPage()

    _page?.setUserAgent(userAgent)

    _page?.setCacheEnabled(true)

    _page?.setCookie(...(params?.cookies || []))

    await _page?.goto(url, {timeout: 0, waitUntil: 'load'})

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

  const cacheKeys = await memory.cache.store.keys('puppeteer:*')
  await Promise.all(lodash.map(cacheKeys, memory.cache.del))
}

export default {browser, close, page}
