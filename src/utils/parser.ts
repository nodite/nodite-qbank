import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'

import {AssetString, ParseOptions} from '../@types/common.js'
import axios from '../components/axios/index.js'
import {handleImageSrc, isUrl} from './index.js'

const audio = async (text: string, _options?: ParseOptions): Promise<AssetString> => {
  if (!text.includes('.mp3')) return {assets: {}, text}

  if (isUrl(text)) text = `<audio src="${text}"></audio>`

  const assetString = {assets: {}} as AssetString

  const root = parse(text)

  for (const audio of root.querySelectorAll('audio')) {
    const src = audio.getAttribute('src')!

    const hash = md5(JSON.stringify({src, type: 'audio'})).slice(0, 8)

    try {
      const resp = await axios.get(src, {responseType: 'arraybuffer'})

      const base64String = Buffer.from(resp.data, 'binary').toString('base64')

      assetString.assets[`[audio#${hash}]`] = `data:${resp.headers['content-type']};base64,${base64String}`

      audio.replaceWith(`[audio#${hash}]`)
    } catch (error: any) {
      audio.replaceWith(`[audio#${error.status}#${src}]`)
    }
  }

  assetString.text = root.toString()

  return assetString
}

const image = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  const assetString = {assets: {}} as AssetString

  const root = parse(text)

  for (const image of root.querySelectorAll('img')) {
    let src = image.getAttribute('src')

    if (!src || src === '</documentfragmentcontainer') continue

    src = await handleImageSrc(src, options?.srcHandler)

    const hash = md5(JSON.stringify({src, type: 'image'})).slice(0, 8)

    try {
      const resp = await axios.get(src, {responseType: 'arraybuffer'})

      const base64String = Buffer.from(resp.data, 'binary').toString('base64')

      assetString.assets[`[img#${hash}]`] = `data:${resp.headers['content-type']};base64,${base64String}`

      image.replaceWith(`[img#${hash}]`)
    } catch (error: any) {
      image.replaceWith(`[img#${error.status}#${src}]`)
    }
  }

  assetString.text = root.toString()

  return assetString
}

const input = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  const assetString = {assets: {}} as AssetString

  const root = parse(text)

  const inputs = root.querySelectorAll('input')

  for (const [idx, input] of inputs.entries()) {
    const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

    const repeat = lodash.ceil(Number(input.getAttribute('size')) / 2) || 1
    const placeholder = input.getAttribute('placeholder')

    if (!lodash.isEmpty(placeholder)) {
      assetString.assets[`[input#${hash}]`] = ` [${placeholder}] `
    } else if (options?.showIndex) {
      assetString.assets[`[input#${hash}]`] = ' [' + '_'.repeat(repeat) + String(idx + 1) + '_'.repeat(repeat) + '] '
    } else {
      assetString.assets[`[input#${hash}]`] = ' [' + '_'.repeat(repeat) + '_'.repeat(repeat) + '] '
    }

    input.replaceWith(`[input#${hash}]`)
  }

  assetString.text = root.toString()

  return assetString
}

const quotes = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  const assetString = {assets: {}} as AssetString

  let idx = 0

  const regexes = [/(\()( *)(\))/g, /(（)( *)(）)/g, /(“)( +)(”)/g]

  for (const regex of regexes) {
    for (const _quote of text.matchAll(regex)) {
      const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

      const repeat = lodash.ceil(_quote[2].length / 2) || 1

      if (options?.showIndex) {
        assetString.assets[`[input#${hash}]`] =
          ` ${_quote[1]}` + '_'.repeat(repeat) + String(idx + 1) + '_'.repeat(repeat) + `${_quote[3]} `
      } else {
        assetString.assets[`[input#${hash}]`] =
          ` ${_quote[1]}` + '_'.repeat(repeat) + '_'.repeat(repeat) + `${_quote[3]} `
      }

      assetString.assets[`[input#${hash}]`] = ' ' + _quote[1] + '_'.repeat(repeat * 2) + _quote[3] + ' '

      text = text.replace(_quote[0], `[input#${hash}]`)

      idx++
    }
  }

  assetString.text = text

  return assetString
}

const underline = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  const assetString = {assets: {}} as AssetString

  text = text.replaceAll(' <wbr>', ' ')

  // 如果有连续的 __，则去掉前后空格
  if (/_{2,}/g.test(text)) {
    // pass
  }
  // 连续空格，连续 \U00A0，连续 \U00A0<wbr>
  else if (/[ |\u00A0]{3,}/g.test(text)) {
    for (const _space of text.matchAll(/[ |\u00A0]{3,}/g)) {
      const _idx = _space.index
      const _spaceCount = _space[0].replaceAll('<wbr>', '').length
      text = text.slice(0, _idx) + '_'.repeat(_spaceCount) + text.slice(_idx + _space[0].length)
    }
  }

  text = lodash.trim(text.replaceAll(' ', ' <wbr>'))

  // 间断的 __ 替换为连续的 __
  while (text.includes('_ _')) {
    text = text.replaceAll('_ _', '__')
  }

  let idx = 0

  for (const _underline of text.matchAll(/_{2,}/g)) {
    const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

    const repeat = lodash.ceil(_underline[0].length / 2) || 1

    if (options?.showIndex) {
      assetString.assets[`[input#${hash}]`] = ' [' + '_'.repeat(repeat) + String(idx + 1) + '_'.repeat(repeat) + '] '
    } else {
      assetString.assets[`[input#${hash}]`] = ' [' + '_'.repeat(repeat) + '_'.repeat(repeat) + '] '
    }

    text = text.replace(_underline[0], `[input#${hash}]`)

    idx++
  }

  assetString.text = text

  return assetString
}

const toAssets = async (text: string, options?: ParseOptions): Promise<AssetString> => {
  const parsed = {assets: {}, text} as AssetString

  // _images.
  const _images = await image(parsed.text, options)
  parsed.text = _images.text
  parsed.assets = {...parsed.assets, ..._images.assets}

  // _audio.
  const _audio = await audio(parsed.text, options)
  parsed.text = _audio.text
  parsed.assets = {...parsed.assets, ..._audio.assets}

  if (!options?.skipInput) {
    // _inputs.
    const _inputs = await input(parsed.text, options)
    parsed.text = _inputs.text
    parsed.assets = {...parsed.assets, ..._inputs.assets}

    // _bracket
    const _quotes = await quotes(parsed.text, options)
    parsed.text = _quotes.text
    parsed.assets = {...parsed.assets, ..._quotes.assets}

    // _underline
    const _underline = await underline(parsed.text, options)
    parsed.text = _underline.text
    parsed.assets = {...parsed.assets, ..._underline.assets}
  }

  return parsed
}

export default {audio, image, input, quotes, toAssets, underline}
