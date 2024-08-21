import Axios from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'

const axiosInstance = setupCache(Axios, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 0, // 0ms
})

axiosInstance.interceptors.response.use(
  (response) => {
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
