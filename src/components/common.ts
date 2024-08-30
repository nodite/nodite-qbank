import cacheManager from '@type-cacheable/core'

import {ComponentMeta} from '../types/common.js'

abstract class Component {
  public static META: ComponentMeta

  public getCacheClient = () => this.cacheClient

  public getUsername = () => this.username

  private cacheClient = (cacheManager.default.client ?? cacheManager.default.fallbackClient) as cacheManager.CacheClient

  private username: string

  constructor(username: string) {
    this.username = username
  }
}

export {Component}
