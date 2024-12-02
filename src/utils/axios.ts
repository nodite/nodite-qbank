import axios from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'
import axiosRetry from 'axios-retry'
import lodash from 'lodash'

const _axios = setupCache(axios, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 1000 * 60 * 5, // 5min
})

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

_axios.interceptors.response.use(
  (response) => {
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
  (error) => {
    console.log('\n')
    console.log('request:', error?.request?.path)
    console.log('response:', error?.response?.data)
    return Promise.reject(error)
  },
)

export default _axios
