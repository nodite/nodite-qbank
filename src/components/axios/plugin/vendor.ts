import {AxiosInstance, AxiosResponse} from 'axios'
import lodash from 'lodash'

const setup = (axios: AxiosInstance): AxiosInstance => {
  axios.interceptors.response.use(async (response) => {
    _biguo(response)
    _wx233(response)
    _fenbi(response)
    _shangfen(response)
    return response
  })

  return axios
}

const _biguo = (response: AxiosResponse) => {
  const url = URL.parse(response.config.url!)

  if (!url?.host.includes('biguotk.com')) return

  const code = lodash.get(response, 'data.result_code')

  if (lodash.isNumber(code) && code !== 1) {
    throw new Error(JSON.stringify(response.data))
  }
}

const _wx233 = (response: AxiosResponse) => {
  const url = URL.parse(response.config.url!)

  if (!url?.host.includes('233.com')) return

  const status = lodash.get(response, 'data.status')

  if (!lodash.isBoolean(status) || status) return

  const code = lodash.get(response, 'data.code')
  const message = lodash.get(response, 'data.message')

  if (code === 999 && message === '考试科目错误') return

  throw new Error(JSON.stringify(response.data))
}

const _fenbi = (response: AxiosResponse) => {
  const url = URL.parse(response.config.url!)

  if (!url?.host.includes('fenbi.com')) return

  if (response.status === 402 && response.statusText === 'Payment Required') return

  const success = lodash.get(response, 'data.success')

  if (lodash.isBoolean(success) && !success) {
    throw new Error(JSON.stringify(response.data))
  }

  if (response.status !== 200) {
    throw new Error(JSON.stringify(response.data))
  }
}

const _shangfen = (response: AxiosResponse) => {
  const url = URL.parse(response.config.url!)

  if (!url?.host.includes('ixunke.cn')) return

  const errno = lodash.get(response, 'data.errno')

  if (errno > 0) {
    throw new Error(JSON.stringify(response.data))
  }
}

export default {setup}
