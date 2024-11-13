import type {DocumentInterface} from '@langchain/core/documents'

import {Embeddings} from '@langchain/core/embeddings'
import {VectorStore} from '@langchain/core/vectorstores'
import {Mutex} from 'async-mutex'
import lodash from 'lodash'

export type SearchOptions = {
  filter?: (item: [DocumentInterface, number]) => boolean
  k?: number
  scoreThreshold?: number
}

export default abstract class BaseFactory {
  protected _collectionNameToStore: Record<string, VectorStore> = {}

  protected _mutex = new Mutex()

  public get collectionNameToStore(): Record<string, VectorStore> {
    return this._collectionNameToStore
  }

  /**
   * Close a collection.
   */
  public async close(collectionName: string): Promise<void> {
    if (this._collectionNameToStore[collectionName]) {
      delete this._collectionNameToStore[collectionName]
    }
  }

  /**
   * Create a collection vectorstore.
   */
  public async create(collectionName: string): Promise<VectorStore> {
    if (!this._collectionNameToStore[collectionName]) {
      const _create = async (factory: BaseFactory) => {
        // Thread-safe
        return factory._mutex.runExclusive(async () => {
          if (!factory._collectionNameToStore[collectionName]) {
            factory._collectionNameToStore[collectionName] = await factory.createVectorStore(collectionName)
          }

          return factory._collectionNameToStore[collectionName]
        })
      }

      this._collectionNameToStore[collectionName] = await _create(this)
    }

    return this._collectionNameToStore[collectionName]
  }

  /**
   * Search in collection.
   */
  public async search(
    collectionName: string,
    query: string,
    options?: SearchOptions,
  ): Promise<[DocumentInterface, number][]> {
    const store = await this.create(collectionName)
    const searches = await store.similaritySearchWithScore(query, options?.k)

    return lodash
      .chain(searches)
      .filter(([doc, score]) => {
        if (lodash.isNumber(options?.scoreThreshold) && score < options.scoreThreshold) {
          return false
        }

        if (options?.filter && !options.filter([doc, score])) {
          return false
        }

        return true
      })
      .orderBy(([_, score]) => score, 'desc')
      .value()
  }

  /**
   * Split query into segments.
   */
  public split2Segments(query: string, embeddingTextStep: number = 5, embeddingTextSize: number = 6): string[] {
    const segments = []

    for (let startIndex = 0; startIndex < query.length; startIndex += embeddingTextStep) {
      const endIndex = lodash.min([startIndex + embeddingTextSize, query.length])
      const segment = query.slice(startIndex, endIndex).trim()
      segments.push(segment)
    }

    return segments
  }

  /**
   * Create a collection vectorstore.
   */
  public abstract createVectorStore(collectionName: string): Promise<VectorStore>

  /**
   * Get ids in collection.
   */
  public abstract getIds(collectionName: string): Promise<string[]>

  /**
   * Search in collection.
   */
  public abstract get model(): Embeddings
}
