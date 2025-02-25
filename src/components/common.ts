import cacheManager from '@type-cacheable/core'

import {ComponentMeta} from '../@types/common.js'

abstract class Component {
  public static META: ComponentMeta

  private username: string

  constructor(username: string) {
    this.username = username
  }

  public getCacheClient = () => {
    if (!cacheManager.default.client) {
      throw new Error('Cache client not found')
    }

    return cacheManager.default.client
  }

  public getUsername = () => this.username

  public getVendorKey = () => (this.constructor as typeof Component).META.key

  public getVendorName = () => (this.constructor as typeof Component).META.name
}

export {Component}
