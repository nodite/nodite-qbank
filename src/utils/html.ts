import fs from 'fs-extra'
import {convert} from 'html-to-text'
import md5 from 'md5'

import {AssertString, ImageOptions} from '../types/common.js'
import parser from './parser.js'
import playwright from './playwright.js'

const _htmlPreprocess = (html: string): string => {
  return html.replaceAll(' ', ' <wbr>').replaceAll('\n', '<br>')
}

const toImage = async (html: string, options?: ImageOptions): Promise<AssertString> => {
  const page = await playwright.page('html', 'about:blank')

  await page.setViewportSize({height: 1, width: options?.width || 940})
  await page.setContent(_htmlPreprocess(html), {waitUntil: 'networkidle'})

  const $ele = await page.$('html')
  const box = await $ele?.boundingBox()

  await page.setViewportSize({height: box?.height || 1, width: options?.width || 940})

  const base64Buffer = await page.screenshot({
    clip: box || {height: 1, width: options?.width || 940, x: 0, y: 0},
    fullPage: true,
    type: 'jpeg',
  })

  fs.writeFileSync('tmp/image.jpeg', base64Buffer, {encoding: 'base64'})

  const hash = md5(html).slice(0, 8)

  return {
    asserts: {[`[html#${hash}]`]: `data:image/jpeg;base64,${base64Buffer.toString('base64')}`},
    text: `[html#${hash}]`,
  }
}

const toText = async (html: string): Promise<AssertString> => {
  const text = await parser.toAssets(
    convert(_htmlPreprocess(html), {
      selectors: [{format: 'skip', selector: 'img'}],
      wordwrap: false,
    }),
  )

  text.text = text.text.replaceAll('\n\n\n', '\n')

  return text
}

export default {toImage, toText}
