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

    const size = input.getAttribute('size')
    const placeholder = input.getAttribute('placeholder')

    assertString.asserts[`[input#${hash}]`] = placeholder
      ? `[${placeholder}]`
      : `[${'_'.repeat(Number(size) / 2)}${idx + 1}${'_'.repeat(Number(size) / 2)}]`

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

    const size = _underline[0].length

    assertString.asserts[`[input#${hash}]`] =
      `[${'_'.repeat(Number(size) / 2)}${idx + 1}${'_'.repeat(Number(size) / 2)}]`

    text = text.replace(_underline[0], `[input#${hash}]`)

    idx++
  }

  assertString.text = text

  return assertString
}

const html = async (text: string): Promise<AssertString> => {
  const parsed = {asserts: {}, text} as AssertString

  // images.
  const images = await image(parsed.text)
  parsed.text = images.text
  parsed.asserts = {...parsed.asserts, ...images.asserts}

  // input.
  const inputs = await input(parsed.text)
  parsed.text = inputs.text
  parsed.asserts = {...parsed.asserts, ...inputs.asserts}

  // underline
  const underlines = await underline(parsed.text)
  parsed.text = underlines.text
  parsed.asserts = {...parsed.asserts, ...underlines.asserts}

  return parsed
}

export default {html, image, input, underline}
