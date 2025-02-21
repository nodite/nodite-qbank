import path from 'node:path'

import fs from 'fs-extra'
import {convert} from 'html-to-text'
import lodash from 'lodash'
import md5 from 'md5'
import {parse} from 'node-html-parser'

import {AssetString, ParseOptions} from '../@types/common.js'
import axios from '../components/axios/index.js'
import {TMP_DIR} from '../env.js'
import {handleImageSrc, throwError} from './index.js'
import parser from './parser.js'
import puppeteer from './puppeteer.js'

const _htmlPreprocess = (html: string): string => {
  return html.replaceAll(' ', ' <wbr>').replaceAll('\n', '<br>')
}

const toImage = async (html: string, options?: ParseOptions): Promise<AssetString> => {
  // image handler
  const _root = parse(_htmlPreprocess(html))

  for (const _img of _root.querySelectorAll('img')) {
    const src = _img.getAttribute('src')

    if (!src) continue

    _img.setAttribute('src', await handleImageSrc(src, options?.srcHandler))
  }

  html = _root.toString()
  const _styles = (options?.style || '').replaceAll('\n', ' ').trim()
  const _html = `${_styles}${html}`

  try {
    let base64String: string

    // if _html just contains <img> tag, get it directly.
    if (/^<img[^>]*>$/.test(html)) {
      const src = parse(html).querySelector('img')?.getAttribute('src')

      if (!src) {
        throwError(new Error('No src found in <img> tag'), html)
      }

      const resp = await axios.get(src, {responseType: 'arraybuffer'})
      base64String = Buffer.from(resp.data, 'binary').toString('base64')
    }
    // otherwise, use puppeteer to render the page.
    else {
      const page = await puppeteer.page('html', 'about:blank')

      await page.setContent(_html, {waitUntil: 'networkidle0'})
      await page.setViewport({height: 1, width: options?.width || 940})

      const $ele = await page.$('html')
      const box = await $ele?.boundingBox()
      const viewport = {
        height: lodash.ceil(box?.height || 1),
        width: lodash.ceil(box?.width || 940),
        x: lodash.floor(box?.x || 0),
        y: lodash.floor(box?.y || 0),
      }

      await page.setViewport(viewport)

      base64String = await page.screenshot({clip: viewport, encoding: 'base64', type: 'jpeg'})
    }

    await fs.writeFile(path.join(TMP_DIR, 'image.jpeg'), base64String, {encoding: 'base64'})

    const hash = md5(html).slice(0, 8)

    return {
      assets: {[`[html#${hash}]`]: `data:image/jpeg;base64,${base64String}`},
      text: `[html#${hash}]`,
    }
  } catch (error) {
    throwError(error, html)
  }
}

const toText = async (html: string, options?: ParseOptions): Promise<AssetString> => {
  const _text = await parser.toAssets(_htmlPreprocess(html), options)

  _text.text = convert(_text.text, {
    selectors: [
      {format: 'skip', selector: 'img'},
      {format: 'skip', selector: 'audio'},
    ],
    wordwrap: false,
  })

  _text.text = _text.text.replaceAll('\n\n\n', '\n')

  return _text
}

export default {handleImageSrc, toImage, toText}
