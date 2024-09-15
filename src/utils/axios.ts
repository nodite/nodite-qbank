import Axios from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'
import lodash from 'lodash'

const axiosInstance = setupCache(Axios, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 1000 * 60 * 5, // 5min
})

axiosInstance.interceptors.response.use(
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

    return response
  },
  (error) => {
    console.log('request:', error?.request?.path)
    console.log('response:', error?.response?.data)
    // console.log('error:', error)
    return Promise.reject(error)
  },
)

export default axiosInstance
