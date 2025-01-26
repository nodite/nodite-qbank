import {Document} from '@langchain/core/documents'
import {Mutex} from 'async-mutex'
import lodash from 'lodash'
import {v5 as uuid} from 'uuid'

import memory from '../cache/memory.manager.js'
import {throwError} from '../utils/index.js'
import BaseFactory from './factory.js'
import Factory from './pgvector/factory.js'

export default class Service {
  public static QUERY_ID = 'queryId'

  private _cache = memory.cache

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

  public async close(): Promise<void> {
    const _factory = await this.factory()

    const closes = lodash
      .chain(_factory.collectionNameToStore)
      .keys()
      .map(async (collectionName) => _factory.close(collectionName))
      .value()

    await Promise.all(closes)
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
    const _cacheId = `embedding:${queryId}`

    const cached = await _cache.get(_cacheId)

    // cached.
    if (cached) return cached as string

    const _factory = await this.factory()

    const _storeIds = await _factory.getIds(collectionName)

    // no store ids.
    if (_storeIds.length === 0) return false

    const _docId = this._uuidByQuery(query)

    // stored.
    if (_storeIds.includes(_docId)) {
      await _cache.set(_cacheId, _docId)
      return _docId
    }

    // search.
    const searched = await _factory.search(collectionName, query.pageContent, {
      filter: ([doc]) => lodash.get(doc.metadata, Service.QUERY_ID) === queryId,
      scoreThreshold: 1,
    })

    if (searched.length === 0) return false

    const docId = lodash.map(searched, ([doc]) => doc.id || this._uuidByQuery(doc)).pop() as string

    await _cache.set(_cacheId, docId)

    return docId
  }

  protected _uuidByQuery(query: Document): string {
    const queryId = lodash.get(query.metadata, Service.QUERY_ID)

    if (!queryId) {
      throw new Error('Query id is not set')
    }

    return uuid(String(queryId), uuid.DNS)
  }

  protected async cache(): Promise<typeof memory.cache> {
    return this._cache
  }
}

const service = new Service()

export {service}
