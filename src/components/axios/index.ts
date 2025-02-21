import axios from 'axios'
import {AxiosCacheInstance, buildMemoryStorage, setupCache} from 'axios-cache-interceptor'
import axiosRetry from 'axios-retry'
import lodash from 'lodash'

import console from '../../utils/console.js'
import cookie from './plugin/cookie.js'
import vendor from './plugin/vendor.js'

const axiosInstance = axios.create()

setupCache(axiosInstance, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 1000 * 60 * 5, // 5min
})

// @ts-ignore
axiosRetry(axiosInstance, {
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

cookie.setup(axiosInstance)

vendor.setup(axiosInstance)

axiosInstance.interceptors.response.use(
  async (response) => response,
  async (error) => {
    console.error('\n')

    const request = error?.request?._currentRequest || error?.request

    if (!request?.host) {
      console.error(error)
    }

    console.error('host:', request?.host)
    console.error('path:', request?.path)
    console.error('error:', error?.message)

    if (error?.response) {
      console.error('message:', error?.response?.statusText)
      console.error('response:', error?.response?.data)
    }

    console.error('\n')

    throw error
  },
)

export default axiosInstance as unknown as AxiosCacheInstance
