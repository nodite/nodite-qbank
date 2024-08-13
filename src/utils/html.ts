import fs from 'fs-extra'
import {convert} from 'html-to-text'
import md5 from 'md5'
import * as puppeteer from 'puppeteer'

import {AssertString, ImageOptions} from '../types/common.js'
import parser from './parser.js'

const toImage = async (html: string, options?: ImageOptions): Promise<AssertString> => {
  const browser = await puppeteer.launch()
  const page = await browser.newPage()

  await page.setViewport({height: 1, width: options?.width || 940})
  await page.setContent(html.replaceAll(' ', ' <wbr>'), {waitUntil: 'networkidle0'})

  const $ele = await page.$('html')
  const box = await $ele?.boundingBox()

  const base64 = await page.screenshot({
    clip: {height: (box?.height || 0) + 5, width: box?.width || 0, x: 0, y: 0},
    encoding: 'base64',
    type: 'jpeg',
  })

  fs.writeFileSync('tmp/image.jpeg', Buffer.from(base64, 'base64'))

  await browser.close()

  const hash = md5(html).slice(0, 8)

  return {
    asserts: {[`[html#${hash}]`]: `data:image/jpeg;base64,${base64}`},
    text: `[html#${hash}]`,
  }
}

const toText = async (html: string): Promise<AssertString> => {
  const text = await parser.html(
    convert(html, {
      selectors: [{format: 'skip', selector: 'img'}],
      wordwrap: false,
    }),
  )

  text.text = text.text.replaceAll('\n\n\n', '\n')

  return text
}

export default {toImage, toText}
