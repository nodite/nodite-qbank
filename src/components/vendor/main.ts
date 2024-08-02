import type {CacheRequestConfig} from 'axios-cache-interceptor'

abstract class Vendor {
  public static name: string

  public abstract login(username: string, password: string): Promise<CacheRequestConfig>
}

export {Vendor}
