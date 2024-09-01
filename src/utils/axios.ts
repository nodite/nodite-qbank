import Axios from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'
import lodash from 'lodash'

const axiosInstance = setupCache(Axios, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 300, // 0ms
})

axiosInstance.interceptors.response.use(
  (response) => {
    // biguo.
    if (lodash.has(response, 'data.result_code') && response.data.result_code !== 1) {
      return Promise.reject(response.data)
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
