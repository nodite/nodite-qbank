import {CacheRequestConfig} from 'axios-cache-interceptor'
import sleep from 'sleep-promise'

import {Params} from '../components/output/common.js'
import {HashKeyScope, Vendor} from '../components/vendor/common.js'
import VendorManager from '../components/vendor/index.js'
import {Bank} from '../types/bank.js'
import {Category} from '../types/category.js'
import {MarkjiSheet} from '../types/sheet.js'
import axios from './axios.js'
import {find} from './index.js'

const ensureContact = async (vendor: Vendor, folder: Bank, deck: Category, requestConfig: CacheRequestConfig) => {
  const chapters = (await vendor.sheets(folder, deck)) as MarkjiSheet[]
  const defaultChapter = find<MarkjiSheet>(chapters, '默认章节') as MarkjiSheet
  const cardId = defaultChapter.cardIds[0]

  const content = `
[P#H1,center#[T#!36b59d#感谢大家的使用]]
由于 app 没有回复反馈的功能，关于牌组的使用问题，可以添加我的微信，请备注来自 Markji。
同时，如果希望[T#!36b59d,!!#添加新牌组]，请[T#!36b59d,!!#提供一下题库信息]，我也会评估工作量再决定是否添加。
（[T#!d16056#因为我也要考研，不一定能抽出太多时间，I'm so sorry！]）

[P#L#[T#B#微信：]oscaner1997]
[P#L#[T#B#新题库信息：]]
1. 题库来源（尽可能详细）
2. 如果是 vip 题库，请提供一个 vip 账号。（不强求，自行考虑）
`

  await (cardId
    ? axios.post(
        `https://www.markji.com/api/v1/decks/${deck.id}/cards/${cardId}`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      )
    : axios.post(
        `https://www.markji.com/api/v1/decks/${deck.id}/chapters/${defaultChapter.id}/cards`,
        {card: {content, grammar_version: 3}, order: 0},
        requestConfig,
      ))
}

/**
 * Markji Info.
 * | -------------- | --------------- | --------------- |
 * | Markji Folders | markji.bank     | params.vendor   |
 * | Markji Decks   | markji.category | params.bank     |
 * | Markji Chapters| markji.sheet    | params.category |
 */
const getInfo = async (
  params: Params,
  username: string,
): Promise<{chapter: MarkjiSheet; deck: Category; folder: Bank}> => {
  const vendorMeta = (params.vendor.constructor as typeof Vendor).META
  const markji = new (VendorManager.getClass('markji'))(username)
  const requestConfig = await markji.login()

  // markji folders.
  await markji.invalidate(HashKeyScope.BANKS)
  let folders = await markji.banks()
  let folder = find<Bank>(folders, vendorMeta.name)

  if (!folder) {
    await axios.post(
      'https://www.markji.com/api/v1/decks/folders',
      {name: vendorMeta.name, order: folders.length},
      requestConfig,
    )

    await sleep(500)
    await markji.invalidate(HashKeyScope.BANKS)
    folders = await markji.banks()
    folder = find<Bank>(folders, vendorMeta.name) as Bank
  }

  // markji decks.
  await markji.invalidate(HashKeyScope.CATEGORIES, folder)
  let decks = await markji.categories(folder)
  let deck = find<Category>(decks, params.bank.name)

  if (!deck) {
    await axios.post(
      'https://www.markji.com/api/v1/decks',
      {folder_id: folder.id, is_private: false, name: params.bank.name},
      requestConfig,
    )

    await sleep(500)
    await markji.invalidate(HashKeyScope.CATEGORIES, folder)
    decks = await markji.categories(folder)
    deck = find<Category>(decks, params.bank.name) as Category
  }

  // markji chapters.
  await markji.invalidate(HashKeyScope.SHEETS, folder, deck)
  let chapters = (await markji.sheets(folder, deck)) as MarkjiSheet[]
  let chapter = find<MarkjiSheet>(chapters, params.category.name)

  if (!chapter) {
    await axios.post(
      `https://www.markji.com/api/v1/decks/${deck.id}/chapters`,
      {name: params.category.name, order: chapters.length},
      requestConfig,
    )

    await sleep(500)
    await markji.invalidate(HashKeyScope.SHEETS, folder, deck)
    chapters = (await markji.sheets(folder, deck)) as MarkjiSheet[]
    chapter = find<MarkjiSheet>(chapters, params.category.name) as MarkjiSheet
  }

  // default card.
  await ensureContact(markji, folder, deck, requestConfig)

  return {chapter, deck, folder}
}

export default {ensureContact, getInfo}
