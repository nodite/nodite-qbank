import {LibSQLVectorStore} from '@langchain/community/vectorstores/libsql'
import {DocumentInterface} from '@langchain/core/documents'
import {Embeddings} from '@langchain/core/embeddings'
import {VectorStore} from '@langchain/core/vectorstores'
import {OllamaEmbeddings} from '@langchain/ollama'
import {Client, createClient} from '@libsql/client'
import {Mutex} from 'async-mutex'
import lodash from 'lodash'
import path from 'node:path'

import {CLI_ASSETS_DIR} from '../../env.js'
import BaseFactory, {SearchOptions} from '../factory.js'

export default class Factory extends BaseFactory {
  protected _collectionNameToClient: Record<string, Client> = {}

  protected _model = new OllamaEmbeddings({
    model: 'paraphrase-multilingual',
  })

  protected _mutex = new Mutex()

  public get model(): Embeddings {
    return this._model
  }

  /**
   * Get a client.
   */
  protected async client(): Promise<Client> {
    return createClient({
      url: 'file:' + path.join(CLI_ASSETS_DIR, 'cache.sqlite3'),
    })
  }

  /**
   * Close a collection.
   */
  public async close(_collectionName: string): Promise<void> {}

  /**
   * Create a collection vectorstore.
   */
  public async createVectorStore(collectionName: string): Promise<VectorStore> {
    const tableName = `vectors_${collectionName}`
    const embeddingCol = 'embedding'
    const embeddingSize = (await this._model.embedQuery('hello world')).length

    const client = await this.client()

    await client.batch(
      [
        `CREATE TABLE IF NOT EXISTS ${tableName} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT,
  metadata TEXT,
  ${embeddingCol} F32_BLOB(${embeddingSize}) -- 768-dimensional f32 vector for paraphrase-multilingual
);`,
        `CREATE INDEX IF NOT EXISTS
idx_${tableName}_${embeddingCol}
ON ${tableName}(libsql_vector_idx(${embeddingCol}));`,
      ],
      'write',
    )

    const vectorstore = new LibSQLVectorStore(this._model, {
      column: 'embedding',
      db: client,
      table: tableName,
    })

    return vectorstore
  }

  /**
   * Get ids in collection.
   */
  public async getIds(collectionName: string): Promise<string[]> {
    const tableName = `vectors_${collectionName}`

    const client = await this.client()
    const result = await client.execute(`SELECT id FROM ${tableName};`)

    return lodash.map(result.rows, (row) => String(row.id))
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
