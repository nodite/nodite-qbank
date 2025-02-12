import {PGVectorStore} from '@langchain/community/vectorstores/pgvector'
import {DocumentInterface} from '@langchain/core/documents'
import {Embeddings} from '@langchain/core/embeddings'
import {VectorStore} from '@langchain/core/vectorstores'
import {OllamaEmbeddings} from '@langchain/ollama'
import lodash from 'lodash'
import {PoolConfig} from 'pg'

import docker from '../../utils/docker.js'
import BaseFactory, {SearchOptions} from '../factory.js'

const cacheHost = await docker.host()

export default class Factory extends BaseFactory {
  public get model(): Embeddings {
    return this._model
  }

  protected _model = new OllamaEmbeddings({
    model: 'bge-m3',
  })

  /**
   * Close a collection.
   */
  public async close(collectionName: string): Promise<void> {
    const store = (await this.create(collectionName)) as PGVectorStore
    await store.end()
    await super.close(collectionName)
  }

  /**
   * Create a collection vectorstore.
   */
  public async createVectorStore(collectionName: string): Promise<VectorStore> {
    const embeddingCol = 'embedding'

    const vectorStore = await PGVectorStore.initialize(this._model, {
      collectionName,
      collectionTableName: 'langchain_pg_collection',
      columns: {
        contentColumnName: 'content',
        idColumnName: 'id',
        metadataColumnName: 'metadata',
        vectorColumnName: embeddingCol,
      },
      distanceStrategy: 'cosine',
      postgresConnectionOptions: {
        connectionString: `postgres://qbank:qbank@${cacheHost}/qbank`,
      } as PoolConfig,
      tableName: 'langchain_pg_embedding',
    })

    return vectorStore
  }

  /**
   * Get ids in collection.
   */
  public async getIds(collectionName: string): Promise<string[]> {
    const store = (await this.create(collectionName)) as PGVectorStore

    let collectionId

    if (store.collectionTableName) {
      collectionId = await store.getOrCreateCollection()
    }

    const queryString = [`SELECT id FROM ${store.computedTableName}`, collectionId ? `WHERE collection_id = $1` : '']
      .join(' ')
      .trim()

    const {rows} = await store.pool.query(queryString, [collectionId])

    return lodash.map(rows, (row) => row.id)
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
      .map(([doc, distance]) => [doc, 1 - distance] as [DocumentInterface, number])
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
}
