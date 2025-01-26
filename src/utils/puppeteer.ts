import {AxiosRequestConfig} from 'axios'
import lodash from 'lodash'
import md5 from 'md5'
import * as puppeteer from 'puppeteer'
import {Cookie} from 'tough-cookie'

import memory from '../cache/memory.manager.js'
import {jar} from './axios.js'

const cookieJar2Puppeteer = (cookie: Cookie): puppeteer.Cookie => {
  const _cookie = {} as puppeteer.Cookie

  _cookie.domain = cookie.domain || ''
  _cookie.domain = _cookie.domain.split('.').length === 2 ? `.${_cookie.domain}` : _cookie.domain

  if (cookie.expires === 'Infinity') {
    _cookie.expires = -1
  } else if (cookie.expires) {
    _cookie.expires = cookie.expires.getTime() / 1000
  } else {
    _cookie.expires = -1
  }

  _cookie.httpOnly = cookie.httpOnly
  _cookie.name = cookie.key
  _cookie.path = cookie.path || '/'
  _cookie.sameSite = cookie.sameSite as puppeteer.CookieSameSite
  _cookie.secure = cookie.secure
  _cookie.session = Boolean(cookie.extensions?.includes('Session'))

  const size = lodash.find(cookie.extensions, (v: string) => v.startsWith('Size'))
  _cookie.size = Number(size?.split('=')?.[1] ?? encodeURIComponent(cookie.value).length)

  _cookie.value = cookie.value

  return _cookie
}

/**
 * Browser.
 */
const browser = async (create: boolean = true) => {
  const cacheKey = 'puppeteer:browser'

  let _browser = await memory.cache.get<puppeteer.Browser>(cacheKey)

  if ((!_browser || !_browser.connected) && create) {
    _browser = await puppeteer.launch({
      // args: ['--auto-open-devtools-for-tabs'],
      // devtools: true,
      headless: true,
      protocolTimeout: 10 * 60 * 1000,
    })
    await memory.cache.set(cacheKey, _browser)
  }

  return _browser
}

/**
 * Page.
 */
const page = async (name: string, url: string, config?: AxiosRequestConfig) => {
  const pageCacheKey = `puppeteer:page:${md5(url)}`

  let _page = await memory.cache.get<puppeteer.Page>(pageCacheKey)

  if (!_page || _page.isClosed()) {
    const _browser = (await browser()) as puppeteer.Browser

    _page = await _browser.newPage()

    await _page!.setUserAgent(
      config?.headers?.['user-agent'] ??
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    )

    await _page!.setExtraHTTPHeaders({
      'Accept-Language': config?.headers?.['accept-language'] ?? 'zh-CN,zh;q=0.9',
    })

    // cookies.
    for (const c of config?.headers?.['set-cookie'] ?? []) {
      const _cookie = Cookie.parse(c) as Cookie
      jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
    }

    const cookies = await jar.store.getAllCookies()

    await _page!.browser().setCookie(...cookies.map((cookie) => cookieJar2Puppeteer(cookie)))

    // params.
    const _url = URL.parse(url)!

    for (const [key, value] of Object.entries(config?.params ?? {})) {
      _url.searchParams.set(key, value as string)
    }

    await _page!.goto(_url.toString(), {timeout: 0, waitUntil: 'load'})

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
