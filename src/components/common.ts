import cacheManager from '@type-cacheable/core'

import {Bank} from '../types/bank.js'
import {Category} from '../types/category.js'
import {Sheet} from '../types/sheet.js'
import {Vendor} from './vendor/common.js'

type ComponentMeta = {
  key: string
  name: string
}

type Params = {
  bank: Bank
  category: Category
  sheet: Sheet
  vendor: Vendor
}

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

export {Component, ComponentMeta, Params}
