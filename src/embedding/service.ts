import {Document} from '@langchain/core/documents'
import {Mutex} from 'async-mutex'
import {MemoryCache, caching} from 'cache-manager'
import lodash from 'lodash'
import {v5 as uuid} from 'uuid'

import {throwError} from '../utils/index.js'
import BaseFactory from './factory.js'
import Factory from './libsql/factory.js'

export default class Service {
  public static QUERY_ID = 'queryId'

  private _cache?: MemoryCache

  private _factory?: BaseFactory

  private _mutex = new Mutex()

  public async addQuery(collectionName: string, queries: Document[]): Promise<void> {
    const _factory = await this.factory()
    const _store = await _factory.create(collectionName)

    for (const query of queries) {
      const question = query.pageContent

      try {
        const embedding = await _factory.model.embedQuery(question)

        const existSegment = await this._existSegment(collectionName, query, embedding)

        if (existSegment) continue

        await _store.addDocuments([query], {ids: [this._uuidByQuery(query)]})
      } catch (error) {
        throwError(error, {query})
      }
    }
  }

  protected async cache(): Promise<MemoryCache> {
    if (!this._cache) {
      const _create = async (service: Service) => {
        // Thread-safe
        return service._mutex.runExclusive(async () => {
          if (!service._cache) {
            service._cache = await caching('memory', {shouldCloneBeforeSet: false, ttl: 1000 * 60 * 60 * 10})
          }

          return service._cache
        })
      }

      this._cache = await _create(this)
    }

    return this._cache
  }

  public async close(): Promise<void> {
    const _factory = await this.factory()

    await Promise.all(
      lodash.map(Object.keys(_factory.collectionNameToStore), async (collectionName) => _factory.close(collectionName)),
    )
  }

  public async deleteQuery(collectionName: string, queries: Document[]): Promise<void> {
    const _factory = await this.factory()
    const _store = await _factory.create(collectionName)

    try {
      const docIds = await Promise.all(lodash.map(queries, async (query) => this._existSegment(collectionName, query)))

      _store.delete({ids: docIds})
    } catch (error) {
      throwError(error, {queries})
    }
  }

  public async factory(): Promise<BaseFactory> {
    if (!this._factory) {
      const _create = async (service: Service) => {
        // Thread-safe
        return service._mutex.runExclusive(async () => {
          if (!service._factory) service._factory = new Factory()
          return service._factory
        })
      }

      this._factory = await _create(this)
    }

    return this._factory
  }

  protected async _existSegment(
    collectionName: string,
    query: Document,
    _embedding?: number[],
  ): Promise<boolean | string> {
    const queryId = lodash.get(query.metadata, Service.QUERY_ID)

    if (!queryId) return false

    const _cache = await this.cache()

    const cached = await _cache.get(queryId)

    // cached.
    if (cached) return cached as string

    const _factory = await this.factory()

    const _storeIds = await _factory.getIds(collectionName)

    // no store ids.
    if (_storeIds.length === 0) return false

    const _docId = this._uuidByQuery(query)

    // stored.
    if (_storeIds.includes(_docId)) {
      await _cache.set(queryId, _docId)
      return _docId
    }

    // search.
    const searched = await _factory.search(collectionName, query.pageContent, {
      filter: ([doc]) => lodash.get(doc.metadata, Service.QUERY_ID) === queryId,
      scoreThreshold: 1,
    })

    if (searched.length === 0) return false

    const docId = lodash.map(searched, ([doc]) => doc.id || this._uuidByQuery(doc)).pop() as string

    await _cache.set(queryId, docId)

    return docId
  }

  protected _uuidByQuery(query: Document): string {
    const queryId = lodash.get(query.metadata, Service.QUERY_ID)

    if (!queryId) {
      throw new Error('Query id is not set')
    }

    return uuid(String(queryId), uuid.DNS)
  }
}

const service = new Service()

export {service}
