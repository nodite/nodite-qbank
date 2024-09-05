import fs from 'fs-extra'
import {convert} from 'html-to-text'
import lodash from 'lodash'
import md5 from 'md5'

import {AssetString, ImageOptions, ParseOptions} from '../types/common.js'
import {throwError} from './index.js'
import parser from './parser.js'
import playwright from './playwright.js'

const _htmlPreprocess = (html: string): string => {
  return html.replaceAll(' ', ' <wbr>').replaceAll('\n', '<br>').trim()
}

const toImage = async (html: string, options?: ImageOptions): Promise<AssetString> => {
  try {
    const page = await playwright.page('html', 'about:blank')

    await page.setContent(_htmlPreprocess(html), {waitUntil: 'networkidle'})
    await page.setViewportSize({height: 1, width: options?.width || 940})

    const $ele = await page.$('html')
    const box = await $ele?.boundingBox()
    const viewport = {
      height: lodash.ceil(box?.height || 1),
      width: lodash.ceil(box?.width || 940),
      x: lodash.floor(box?.x || 0),
      y: lodash.floor(box?.y || 0),
    }

    await page.setViewportSize(viewport)

    const base64Buffer = await page.screenshot({clip: viewport, fullPage: true, type: 'jpeg'})

    fs.writeFileSync('tmp/image.jpeg', base64Buffer, {encoding: 'base64'})

    const hash = md5(html).slice(0, 8)

    return {
      assets: {[`[html#${hash}]`]: `data:image/jpeg;base64,${base64Buffer.toString('base64')}`},
      text: `[html#${hash}]`,
    }
  } catch (error) {
    throwError(error, html)
  }
}

const toText = async (html: string, options?: ParseOptions): Promise<AssetString> => {
  const _text = await parser.toAssets(_htmlPreprocess(html), options)

  _text.text = convert(_text.text, {
    selectors: [{format: 'skip', selector: 'img'}],
    wordwrap: false,
  })

  _text.text = _text.text.replaceAll('\n\n\n', '\n')

  return _text
}

export default {toImage, toText}
