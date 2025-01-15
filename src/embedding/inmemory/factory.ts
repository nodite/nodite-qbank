import path from 'node:path'

import {SynchronousInMemoryDocstore} from '@langchain/community/stores/doc/in_memory'
import {FaissStore} from '@langchain/community/vectorstores/faiss'
import {DocumentInterface} from '@langchain/core/documents'
import {Embeddings} from '@langchain/core/embeddings'
import {VectorStore} from '@langchain/core/vectorstores'
import {OllamaEmbeddings} from '@langchain/ollama'
import fs from 'fs-extra'
import lodash from 'lodash'

import {CLI_ASSETS_DIR, PKG_ASSETS_DIR} from '../../env.js'
import BaseFactory, {SearchOptions} from '../factory.js'

export default class Factory extends BaseFactory {
  protected _model = new OllamaEmbeddings({
    model: 'paraphrase-multilingual',
  })

  public get model(): Embeddings {
    return this._model
  }

  /**
   * Close a collection.
   */
  public async close(collectionName: string): Promise<void> {
    if (this._collectionNameToStore[collectionName]) {
      const store = this._collectionNameToStore[collectionName] as FaissStore
      const storeDir = path.join(CLI_ASSETS_DIR, 'vectorstore', collectionName)
      await store.save(storeDir)
    }

    super.close(collectionName)
  }

  /**
   * Create a collection vectorstore.
   */
  public async createVectorStore(collectionName: string): Promise<VectorStore> {
    const storeDir = path.join(CLI_ASSETS_DIR, 'vectorstore', collectionName)
    const backDir = path.join(PKG_ASSETS_DIR, 'vectorstore', collectionName)

    let vectorstore: FaissStore

    if (fs.existsSync(storeDir)) {
      vectorstore = await FaissStore.load(storeDir, this._model)
    } else if (fs.existsSync(backDir)) {
      vectorstore = await FaissStore.load(backDir, this._model)
    } else {
      const {IndexFlatL2} = await FaissStore.importFaiss()

      vectorstore = new FaissStore(this._model, {
        docstore: new SynchronousInMemoryDocstore(),
        index: new IndexFlatL2((await this.model.embedQuery('hello world')).length),
        mapping: {},
      })
    }

    return vectorstore
  }

  /**
   * Get ids in collection.
   */
  public async getIds(collectionName: string): Promise<string[]> {
    const store = (await this.create(collectionName)) as FaissStore
    return Object.values(store.getMapping())
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
