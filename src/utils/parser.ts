import {parse} from 'node-html-parser'

import {AssertString} from '../types/common.js'
import axios from './axios.js'

const html = async (text: string): Promise<AssertString> => {
  const assertString = {asserts: {}} as AssertString

  const root = parse(text)

  // images.
  const images = root.querySelectorAll('img')

  for (const [idx, image] of images.entries()) {
    const src = image.getAttribute('src')

    if (!src) continue

    const resp = await axios.get(src, {responseType: 'arraybuffer'})
    const base64 = Buffer.from(resp.data, 'binary').toString('base64')

    assertString.asserts[`[img#${idx}]`] = `data:${resp.headers['content-type']};base64,${base64}`

    image.replaceWith(`[img#${idx}]`)
  }

  // input.
  const inputs = root.querySelectorAll('input')

  for (const [idx, input] of inputs.entries()) {
    const size = input.getAttribute('size')
    const placeholder = input.getAttribute('placeholder')

    assertString.asserts[`[input#${idx}]`] = placeholder || '_'.repeat(Number(size))

    input.replaceWith(`[input#${idx}]`)
  }

  assertString.text = root.toString()

  return assertString
}

export {html}
