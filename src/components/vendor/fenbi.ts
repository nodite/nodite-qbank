import type {CacheRequestConfig} from 'axios-cache-interceptor'

import {Cacheable} from '@type-cacheable/core'
import UserAgent from 'user-agents'

import axios from '../../utils/axios.js'
import {Vendor} from './main.js'

const VENDOR_NAME = 'fenbi'

export default class Fenbi extends Vendor {
  public static name: string = VENDOR_NAME

  @Cacheable({cacheKey: (args) => args[0], hashKey: `${VENDOR_NAME}:login`})
  public async login(username: string, password: string): Promise<CacheRequestConfig> {
    const userAgent = new UserAgent().toString()
    const params = {
      app: 'web',
      av: 100,
      kav: 100,
      version: '3.0.0.0',
    }

    const response = await axios.post(
      'https://login.fenbi.com/api/users/loginV2',
      {
        app: 'web',
        password,
        persistent: 1,
        phone: username,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': userAgent,
        },
        params,
      },
    )

    return {
      headers: {
        Cookie: response.headers['set-cookie']?.join(';') as string,
        'User-Agent': userAgent,
      },
      params,
    }
  }
}
