import Axios from 'axios'
import {buildMemoryStorage, setupCache} from 'axios-cache-interceptor'

const axiosInstance = setupCache(Axios, {
  interpretHeader: false,
  storage: buildMemoryStorage(),
  ttl: 1000 * 60,
})

axiosInstance.interceptors.request.use(
  (response) => {
    return response
  },
  (error) => {
    console.log('request:', error?.request?.path)
    console.log('error:', error)
    return Promise.reject(error)
  },
)

export default axiosInstance
