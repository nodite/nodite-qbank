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
    _browser = await puppeteer.launch({
      args: [
        // performance
        '--no-sandbox',
        '--disable-extensions',
      ],
      headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      protocolTimeout: 10 * 60 * 1000,
    })
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

    const _browser = (await browser()) as puppeteer.Browser

    _page = await _browser.newPage()

    await _page?.setUserAgent(userAgent)

    await _page?.setCacheEnabled(false)

    await _page?.setCookie(...(params?.cookies || []))

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

  const cacheKeys = [] as string[]

  for (const key of memory.store.keys) {
    if (String(key).startsWith('puppeteer:')) cacheKeys.push(key)
  }

  await memory.cache.mdel(cacheKeys)
}

export default {browser, close, page}
