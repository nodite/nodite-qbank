import {CacheRequestConfig} from 'axios-cache-interceptor'
import {dataUriToBuffer} from 'data-uri-to-buffer'
import FormData from 'form-data'
import lodash from 'lodash'
import sleep from 'sleep-promise'
import * as streamifier from 'streamifier'

import memory from '../../cache/memory.manager.js'
import axios from '../../components/axios/index.js'
import {CACHE_KEY_QUESTION_ITEM} from '../../components/cache-pattern.js'
import {Output} from '../../components/output/common.js'
import {HashKeyScope, Vendor} from '../../components/vendor/common.js'
import VendorManager from '../../components/vendor/index.js'
import {Bank, MarkjiFolder} from '../../types/bank.js'
import {Category} from '../../types/category.js'
import {AssetString, ParseOptions, QBankParams} from '../../types/common.js'
import {MarkjiChapter, Sheet} from '../../types/sheet.js'
import {BulkUploadOptions, MarkjiInfo} from '../../types/vendor/markji.js'
import {emitter} from '../event.js'
import html from '../html.js'
import {find, safeName, throwError} from '../index.js'

const ensureContact = async (
  markji: {deck: Category; folder: Bank; vendor: Vendor},
  requestConfig: CacheRequestConfig,
) => {
  await markji.vendor.invalidate(HashKeyScope.SHEETS, {bank: markji.folder, category: markji.deck})
  const chapters = (await markji.vendor.sheets({bank: markji.folder, category: markji.deck})) as MarkjiChapter[]
  const defaultChapter = find<MarkjiChapter>(chapters, '默认章节') as MarkjiChapter
  const cardId = defaultChapter.cardIds[0]

  // if (cardId) {
  //   bulkDelete({...params, chapter: defaultChapter, requestConfig}, [cardId])
  // }

  // const content = `
  // [P#H1,center#[T#!36b59d#感谢大家的使用]]
  // 由于 app 没有回复反馈的功能，关于牌组的使用问题，可以添加我的微信，请备注来自 Markji。
  // 同时，如果希望[T#!36b59d,!!#添加新牌组]，请[T#!36b59d,!!#提供一下题库信息]，我也会评估工作量再决定是否添加。

  // [P#L#[T#B#微信：]oscaner1997]
  // [P#L#[T#B#新题库信息：]]
  // 1. 题库来源（尽可能详细）
  // 2. 如果是 vip 题库，请提供一个 vip 账号。（不强求，自行考虑）
  // `

  const content = [
    '',
    '[P#H1,center#[T#!36b59d#感谢大家的使用]]',
    '如果有任何问题，请评论留下你的联系方式，我会尽快回复。',
    '',
  ].join('\n')

  await (cardId
    ? axios.post(
        `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/${cardId}`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      )
    : axios.post(
        `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${defaultChapter.id}/cards`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      ))
}

/**
 * _folder.
 */
const _folder = async (
  markji: {vendor: Vendor},
  params: {vendor: Vendor},
  requestConfig: CacheRequestConfig,
): Promise<MarkjiFolder> => {
  await markji.vendor.invalidate(HashKeyScope.BANKS)

  const vendorMeta = (params.vendor.constructor as typeof Vendor).META

  let folders = await markji.vendor.banks()
  let folder = find<MarkjiFolder>(folders, vendorMeta.name)

  // create.
  if (!folder) {
    await axios.post(
      'https://www.markji.com/api/v1/decks/folders',
      {name: vendorMeta.name, order: folders.length},
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.vendor.invalidate(HashKeyScope.BANKS)
    folders = await markji.vendor.banks()
    folder = find<MarkjiFolder>(folders, vendorMeta.name) as Bank
  }

  return folder
}

/**
 * _deck.
 */
const _deck = async (
  markji: {folder: MarkjiFolder; vendor: Vendor},
  qbank: {bank: Bank; vendor: Vendor},
  requestConfig: CacheRequestConfig,
): Promise<Category> => {
  await markji.vendor.invalidate(HashKeyScope.CATEGORIES, {bank: markji.folder})

  const vendorMeta = (qbank.vendor.constructor as typeof Vendor).META
  let decks = await markji.vendor.categories({bank: markji.folder})
  let deck = find<Category>(decks, qbank.bank.name)

  // create.
  if (!deck) {
    await axios.post(
      'https://www.markji.com/api/v1/decks',
      {
        description: markji.folder.name,
        folder_id: markji.folder.id,
        is_private: false,
        name: qbank.bank.name,
        order: decks.length,
      },
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.vendor.invalidate(HashKeyScope.CATEGORIES, {bank: markji.folder})
    decks = await markji.vendor.categories({bank: markji.folder})
    deck = find<Category>(decks, qbank.bank.name) as Category
  }

  // update description.
  if (deck.meta?.description !== vendorMeta.key) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${deck.id}`,
      {description: vendorMeta.key, is_private: deck.meta?.is_private, name: deck.name},
      requestConfig,
    )

    await markji.vendor.invalidate(HashKeyScope.CATEGORIES, {bank: markji.folder})
    decks = await markji.vendor.categories({bank: markji.folder})
    deck = find<Category>(decks, qbank.bank.name) as Category
  }

  // sort.
  if (deck.order !== qbank.bank.order) {
    markji.folder = lodash.find(await markji.vendor.banks(), {id: markji.folder.id}) as MarkjiFolder

    const _occupier = lodash.find(decks, {order: qbank.bank.order})

    if (_occupier) {
      _occupier.order = deck.order
    }

    deck.order = qbank.bank.order

    await axios.post(
      `https://www.markji.com/api/v1/decks/folders/${markji.folder.id}/sort`,
      {
        items: lodash
          .chain(decks)
          .filter((deck) => deck.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map((deck) => ({object_class: 'DECK', object_id: deck.id}))
          .value(),
        updated_time: markji.folder.updated_time,
      },
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.vendor.invalidate(HashKeyScope.CATEGORIES, {bank: markji.folder})
    decks = await markji.vendor.categories({bank: markji.folder})
    deck = find<Category>(decks, qbank.bank.name) as Category
  }

  return deck
}

/**
 * _chapter.
 */
const _chapterName = async (qbank: {category: Category; sheet: Sheet}): Promise<string> => {
  return safeName(qbank.sheet.id === '0' ? qbank.category.name : `${qbank.category.name} / ${qbank.sheet.name}`)
}

const _chapter = async (
  markji: {deck: Category; folder: MarkjiFolder; vendor: Vendor},
  qbank: {bank: Bank; category: Category; sheet: Sheet; vendor: Vendor},
  requestConfig: CacheRequestConfig,
): Promise<MarkjiChapter> => {
  await markji.vendor.invalidate(HashKeyScope.SHEETS, {bank: markji.folder, category: markji.deck})

  const chapterName = await _chapterName(qbank)

  let chapters = (await markji.vendor.sheets({bank: markji.folder, category: markji.deck})) as MarkjiChapter[]
  let chapter = find<MarkjiChapter>(chapters, chapterName)

  // create.
  if (!chapter) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters`,
      {name: chapterName, order: chapters.length},
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.vendor.invalidate(HashKeyScope.SHEETS, {bank: markji.folder, category: markji.deck})
    chapters = (await markji.vendor.sheets({bank: markji.folder, category: markji.deck})) as MarkjiChapter[]
    chapter = find<MarkjiChapter>(chapters, chapterName) as MarkjiChapter
  }

  // sort.
  let _paramSheetOrder = 1

  for (const _category of await qbank.vendor.categories(qbank, {excludeTtl: true})) {
    if (_category.id === qbank.category.id) {
      _paramSheetOrder += qbank.sheet.order || 0
      break
    }

    const _sheets = await qbank.vendor.sheets({bank: qbank.bank, category: _category}, {excludeTtl: true})
    _paramSheetOrder += _sheets.length
  }

  if (chapter.order !== _paramSheetOrder) {
    const _occupier = lodash.find(chapters, {order: _paramSheetOrder})

    if (_occupier) {
      _occupier.order = chapter.order
    }

    chapter.order = _paramSheetOrder

    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/sort`,
      {
        chapter_ids: lodash
          .chain(chapters)
          .filter((chapter) => chapter.id !== '*')
          .sortBy(['order', 'name'], ['asc', 'asc'])
          .map('id')
          .value(),
        revision: chapter.setRevision,
      },
      lodash.merge({}, requestConfig, {cache: false}),
    )

    await markji.vendor.invalidate(HashKeyScope.SHEETS, {bank: markji.folder, category: markji.deck})
    chapters = (await markji.vendor.sheets({bank: markji.folder, category: markji.deck})) as MarkjiChapter[]
    chapter = find<MarkjiChapter>(chapters, chapterName) as MarkjiChapter
  }

  return chapter
}

/**
 * Markji Info.
 * | -------------- | --------------- | --------------- |
 * | Markji Folders | markji.bank     | qbank.vendor   |
 * | Markji Decks   | markji.category | qbank.bank     |
 * | Markji Chapters| markji.sheet    | qbank.category |
 */
const getInfo = async (qbank: QBankParams, username: string): Promise<MarkjiInfo> => {
  const markji = new (VendorManager.getClass('markji'))(username)
  const config = await markji.login()

  // markji folders.
  const folder = await _folder({vendor: markji}, {vendor: qbank.vendor}, config)

  // ==========================
  // markji decks.
  const deck = await _deck({folder, vendor: markji}, {bank: qbank.bank, vendor: qbank.vendor}, config)

  // ==========================
  // markji chapters.
  const chapter = await _chapter(
    {deck, folder, vendor: markji},
    {bank: qbank.bank, category: qbank.category, sheet: qbank.sheet, vendor: qbank.vendor},
    config,
  )

  // ==========================
  // default card.
  await ensureContact({deck, folder, vendor: markji}, config)

  // prune dirty.
  await pruneDirty({bank: qbank.bank, vendor: qbank.vendor}, {config, deck, folder, vendor: markji})

  return {chapter, deck, folder}
}

/**
 * Parse HTML.
 */
const parseHtml = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  let content = await html.toText(text, options)

  if (
    // large content.
    content.text.length > 800 ||
    // has image.
    find(Object.values(content.assets), 'data:', {fuzzy: true}) ||
    // has underline.
    text.includes('<u>') ||
    // has span.
    text.includes('<span') ||
    // 上标
    text.includes('<sup>') ||
    // 下标
    text.includes('<sub>') ||
    // 加粗
    text.includes('<b>')
  ) {
    content = await html.toImage(text, options)
  }

  return content
}

/**
 * Bulk Delete.
 */
const bulkDelete = async (markji: MarkjiInfo, cardIds: string[]): Promise<void> => {
  const chunks = lodash
    .chain(cardIds)
    .map((cardId) => [markji.chapter.id, cardId])
    .chunk(50)
    .value()

  for (const _chunk of chunks) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/remove`,
      {cards: _chunk},
      markji.config,
    )
  }
}

/**
 * Bulk Upload.
 */
const bulkUpload = async (options: BulkUploadOptions): Promise<void> => {
  // default options.
  options.uploadOptions = options.uploadOptions || {}

  // prepare.
  const {cacheClient, markji, qbank, uploadOptions} = options

  // check questions.
  const allQuestionKeys = lodash
    .chain(
      await cacheClient.keys(
        lodash.template(CACHE_KEY_QUESTION_ITEM)({
          bankId: qbank.bank.id,
          categoryId: qbank.category.id,
          outputKey: (qbank.output?.constructor as typeof Output).META.key,
          questionId: '*',
          sheetId: qbank.sheet.id,
          vendorKey: (qbank.vendor.constructor as typeof Vendor).META.key,
        }),
      ),
    )
    .sort((a, b) => Number(a) - Number(b)) // asc.
    .value()

  if (markji.chapter.count < allQuestionKeys.length) {
    uploadOptions.reupload = true
  }

  const doneQuestionCount = uploadOptions?.reupload ? 0 : markji.chapter.count || 0
  const doneQuestionIdx = doneQuestionCount - 1

  // delete
  if (markji.chapter.cardIds.length > 0 && allQuestionKeys.length === 0) {
    throwError('Dangerous', {qbank})
  }

  await bulkDelete(markji, markji.chapter.cardIds.slice(allQuestionKeys.length))

  // upload.
  if (uploadOptions?.totalEmit) uploadOptions?.totalEmit(allQuestionKeys.length)

  emitter.emit('output.upload.count', doneQuestionCount || 0)

  if (allQuestionKeys.length > doneQuestionCount) {
    // upload.
    for (const [_questionIdx, _questionKey] of allQuestionKeys.entries()) {
      // skip.
      if (_questionIdx <= doneQuestionIdx) {
        emitter.emit('output.upload.count', _questionIdx + 1)
        continue
      }

      const _question: AssetString = await cacheClient.get(_questionKey)

      await upload(markji, _questionIdx, _question)

      // emit.
      emitter.emit('output.upload.count', _questionIdx + 1)
      // await sleep(500)
    }
  }

  emitter.emit('output.upload.count', allQuestionKeys.length)

  await sleep(500)

  emitter.closeListener('output.upload.count')
}

/**
 * Upload.
 */
const upload = async (markji: MarkjiInfo, index: number, question: AssetString): Promise<void> => {
  if (lodash.isEmpty(question)) return

  for (const [key, value] of Object.entries(question.assets)) {
    if (value.startsWith('data:')) {
      const parsed = dataUriToBuffer(value)

      // filename
      let filename = key + '.' + parsed.type.split('/')[1]

      if (parsed.type.startsWith('audio')) {
        filename = key + '.mp3'
      }

      // form.
      const form = new FormData()

      form.append('file', streamifier.createReadStream(Buffer.from(parsed.buffer)), {
        contentType: parsed.type,
        filename,
      })

      const response = await axios.post('https://www.markji.com/api/v1/files', form, markji.config)

      if (response.data.data.file.mime.startsWith('image')) {
        question.assets[key] = `[Pic#ID/${response.data.data.file.id}#]`
      } else if (response.data.data.file.mime.startsWith('audio')) {
        question.assets[key] = `[Audio#ID/${response.data.data.file.id}#]`
      }
    }

    question.text = question.text.replaceAll(key, question.assets[key])
  }

  const cardId = markji.chapter.cardIds[index]

  try {
    await (cardId
      ? axios.post(
          `https://www.markji.com/api/v1/decks/${markji.deck.id}/cards/${cardId}`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          markji.config,
        )
      : axios.post(
          `https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${markji.chapter.id}/cards`,
          {card: {content: question.text, grammar_version: 3}, order: index},
          markji.config,
        ))
  } catch (error) {
    throwError('Upload failed.', {error, question})
  }
}

/**
 * Prune dirty.
 */
const pruneDirty = async (
  qbank: {bank: Bank; vendor: Vendor},
  markji: {config: CacheRequestConfig; deck: Category; folder: MarkjiFolder; vendor: Vendor},
): Promise<void> => {
  const status = await memory.cache.get<boolean>(`markji:pruneDirty:${qbank.bank.id}`)

  if (status) return

  const categories = await qbank.vendor.categories({bank: qbank.bank})

  const allChapterNames = new Set(
    (
      await Promise.all(
        lodash.map(categories, async (cat) => {
          const sheets = await qbank.vendor.sheets({bank: qbank.bank, category: cat})

          return Promise.all(lodash.map(sheets, (sheet) => _chapterName({category: cat, sheet})))
        }),
      )
    ).flat(),
  )

  const todoChapters = lodash.filter(
    (await markji.vendor.sheets({bank: markji.folder, category: markji.deck}, {excludeTtl: true})) as MarkjiChapter[],
    (chapter) => {
      if (chapter.name === '默认章节') return false
      return !allChapterNames.has(chapter.name)
    },
  )

  for (const chapter of todoChapters) {
    await bulkDelete({...markji, chapter}, chapter.cardIds)
    await axios.delete(`https://www.markji.com/api/v1/decks/${markji.deck.id}/chapters/${chapter.id}`, markji.config)
  }

  await memory.cache.set(`markji:pruneDirty:${qbank.bank.id}`, true)
}

export default {bulkDelete, bulkUpload, ensureContact, getInfo, parseHtml, pruneDirty, upload}
