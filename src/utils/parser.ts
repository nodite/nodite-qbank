import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'

import {AssertString} from '../types/common.js'
import axios from './axios.js'

const image = async (text: string): Promise<AssertString> => {
  const assertString = {asserts: {}} as AssertString

  const root = parse(text)
  const images = root.querySelectorAll('img')

  for (const [idx, image] of images.entries()) {
    const src = image.getAttribute('src')

    if (!src) continue

    const hash = md5(JSON.stringify({index: idx, text, type: 'image'})).slice(0, 8)

    const resp = await axios.get(src, {responseType: 'arraybuffer'})
    const base64 = Buffer.from(resp.data, 'binary').toString('base64')

    assertString.asserts[`[img#${hash}]`] = `data:${resp.headers['content-type']};base64,${base64}`

    image.replaceWith(`[img#${hash}]`)
  }

  assertString.text = root.toString()

  return assertString
}

const input = async (text: string): Promise<AssertString> => {
  const assertString = {asserts: {}} as AssertString

  const root = parse(text)

  const inputs = root.querySelectorAll('input')

  for (const [idx, input] of inputs.entries()) {
    const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

    const repeat = lodash.ceil(Number(input.getAttribute('size')) / 2) || 1
    const placeholder = input.getAttribute('placeholder')

    assertString.asserts[`[input#${hash}]`] = placeholder
      ? `[${placeholder}]`
      : '[' + '_'.repeat(repeat) + (idx + 1) + '_'.repeat(repeat) + ']'

    input.replaceWith(`[input#${hash}]`)
  }

  assertString.text = root.toString()

  return assertString
}

const underline = async (text: string): Promise<AssertString> => {
  const assertString = {asserts: {}} as AssertString

  let idx = 0

  for (const _underline of text.matchAll(/_{2,}/g)) {
    const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

    const repeat = lodash.ceil(_underline[0].length) || 1

    assertString.asserts[`[input#${hash}]`] = '[' + '_'.repeat(repeat) + (idx + 1) + '_'.repeat(repeat) + ']'

    text = text.replace(_underline[0], `[input#${hash}]`)

    idx++
  }

  assertString.text = text

  return assertString
}

const quotes = async (text: string): Promise<AssertString> => {
  const assertString = {asserts: {}} as AssertString

  let idx = 0

  const regexes = [/(\()( *)(\))/g, /(（)( *)(）)/g, /(“)( +)(”)/g]

  for (const regex of regexes) {
    for (const _quote of text.matchAll(regex)) {
      const hash = md5(JSON.stringify({index: idx, text, type: 'input'})).slice(0, 8)

      const repeat = lodash.ceil(_quote[2].length / 2) || 1

      assertString.asserts[`[input#${hash}]`] =
        _quote[1] + '_'.repeat(repeat) + (idx + 1) + '_'.repeat(repeat) + _quote[3]

      text = text.replace(_quote[0], `[input#${hash}]`)

      idx++
    }
  }

  assertString.text = text

  return assertString
}

const toAssets = async (text: string): Promise<AssertString> => {
  const parsed = {asserts: {}, text} as AssertString

  // _images.
  const _images = await image(parsed.text)
  parsed.text = _images.text
  parsed.asserts = {...parsed.asserts, ..._images.asserts}

  // _inputs.
  const _inputs = await input(parsed.text)
  parsed.text = _inputs.text
  parsed.asserts = {...parsed.asserts, ..._inputs.asserts}

  // _underline
  const _underline = await underline(parsed.text)
  parsed.text = _underline.text
  parsed.asserts = {...parsed.asserts, ..._underline.asserts}

  // _bracket
  const _quotes = await quotes(parsed.text)
  parsed.text = _quotes.text
  parsed.asserts = {...parsed.asserts, ..._quotes.asserts}

  return parsed
}

export default {image, input, quotes, toAssets, underline}
