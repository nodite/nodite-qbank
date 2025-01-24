import axios, {AxiosRequestConfig} from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'
import axiosRetry from 'axios-retry'
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http'
import lodash from 'lodash'
import puppeteer from 'puppeteer'
import {Cookie, CookieJar} from 'tough-cookie'

const jar = new CookieJar()

const _axios = setupCache(
  axios.create({
    httpAgent: new HttpCookieAgent({cookies: {jar}}),
    httpsAgent: new HttpsCookieAgent({cookies: {jar}}),
    maxRedirects: 0,
  }),
  {
    interpretHeader: false,
    storage: buildMemoryStorage(),
    ttl: 1000 * 60 * 5, // 5min
  },
)

// @ts-ignore
axiosRetry(_axios, {
  retries: 3,
  retryCondition(error: any) {
    if (lodash.isNumber(error.response?.status) && error.response.status >= 500 && error.response.status <= 599) {
      return true
    }

    if (axiosRetry.isNetworkOrIdempotentRequestError(error)) {
      return true
    }

    return false
  },
  retryDelay: axiosRetry.linearDelay(2000),
})

_axios.interceptors.request.use(
  async (config) => {
    for (const c of config.headers['set-cookie'] ?? []) {
      const _cookie = Cookie.parse(c) as Cookie
      jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
    }

    delete config.headers['set-cookie']

    config.headers.Cookie = config.headers.Cookie
      ? `${config.headers.Cookie}; ${jar.getCookieStringSync(config.url!)}`
      : jar.getCookieStringSync(config.url!)

    return config
  },
  async (error) => {
    throw error
  },
)

_axios.interceptors.response.use(
  async (response) => {
    // store cookies to jar.
    for (const c of response.headers['set-cookie'] ?? []) {
      const _cookie = Cookie.parse(c) as Cookie
      jar.setCookieSync(_cookie, `https://${_cookie.domain}${_cookie.path}`)
    }

    // biguo.
    if (
      lodash.has(response, 'data.result_code') &&
      lodash.isNumber(response.data.result_code) &&
      response.data.result_code !== 1
    ) {
      throw new Error(JSON.stringify(response.data))
    }

    // wx233.
    if (lodash.has(response, 'data.status') && lodash.isBoolean(response.data.status) && !response.data.status) {
      if (response.data.code === 999 && response.data.message === '考试科目错误') {
        // pass
      } else {
        throw new Error(JSON.stringify(response.data))
      }
    }

    // fenbi.
    if (response.config.url?.includes('fenbi.com')) {
      if (response.status === 402 && response.statusText === 'Payment Required') {
        // pass
      } else if (
        lodash.has(response, 'data.success') &&
        lodash.isBoolean(response.data.success) &&
        !response.data.success
      ) {
        throw new Error(JSON.stringify(response.data))
      } else if (response.status !== 200) {
        throw new Error(JSON.stringify(response.data))
      }
    }

    // shangfen
    if (lodash.has(response, 'data.errno') && response.data.errno > 0) {
      throw new Error(JSON.stringify(response.data))
    }

    return response
  },
  async (error) => {
    if (error.status === 302) {
      const _nextConfig = lodash.merge({}, error.config, {
        headers: {Cookie: jar.getCookieStringSync(error.config.url!)},
        url: error.response.headers.location,
      } as AxiosRequestConfig)
      const resp = await _axios.request(_nextConfig)
      return resp
    }

    console.log('\n')
    console.log('request:', error?.request?.path)
    console.log('response:', error?.response?.data)
    throw error
  },
)

const setCookieSyntax = (cookie: Cookie | puppeteer.Cookie) => {
  const _cookie = []

  if (cookie instanceof Cookie) {
    _cookie.push(`${cookie.key}=${cookie.value}`)

    if (cookie.domain) _cookie.push(`Domain=${cookie.domain}`)
    if (cookie.path) _cookie.push(`Path=${cookie.path}`)
    if (cookie.expires) _cookie.push(`Expires=${cookie.expires}`)
    if (cookie.httpOnly) _cookie.push(`HttpOnly`)
    if (cookie.secure) _cookie.push(`Secure`)
    if (cookie.sameSite) _cookie.push(`SameSite=${cookie.sameSite}`)
    if (cookie.maxAge) _cookie.push(`Max-Age=${cookie.maxAge}`)
    if (cookie.extensions) _cookie.push(...cookie.extensions)
  } else {
    _cookie.push(`${cookie.name}=${cookie.value}`)

    if (cookie.domain) _cookie.push(`Domain=${cookie.domain}`)
    if (cookie.path) _cookie.push(`Path=${cookie.path}`)
    if (cookie.expires) _cookie.push(`Expires=${cookie.expires}`)
    if (cookie.httpOnly) _cookie.push(`HttpOnly`)
    if (cookie.secure) _cookie.push(`Secure`)
    if (cookie.sameSite) _cookie.push(`SameSite=${cookie.sameSite}`)
    if (cookie.size > 0) _cookie.push(`Size=${cookie.size}`)
    if (cookie.session) _cookie.push(`Session`)
    if (cookie.priority) _cookie.push(`Priority=${cookie.priority}`)
  }

  return _cookie.join('; ')
}

export default _axios
export {jar, setCookieSyntax}
