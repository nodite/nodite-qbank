/* eslint-disable complexity */
import lodash from 'lodash'

import {isJSON, throwError} from '../index.js'
import puppeteer from '../puppeteer.js'

const PUBLIC_KEY =
  'ANKi9PWuvDOsagwIVvrPx77mXNV0APmjySsYjB1' +
  '/GtUTY6cyKNRl2RCTt608m9nYk5VeCG2EAZRQmQ' +
  'NQTyfZkw0Uo+MytAkjj17BXOpY4o6+BToi7rRKf' +
  'TGl6J60/XBZcGSzN1XVZ80ElSjaGE8Ocg8wbPN18tbmsy761zN5SuIl'

const encrypt = async (data1: any | null, data2: any | null): Promise<null | string> => {
  const page = await puppeteer.page('fenbi', 'https://www.fenbi.com')

  // wait window.encrypt
  await page.waitForFunction(
    () => {
      return (window as any).encrypt
    },
    {timeout: 0},
  )

  const encrypt = await page.evaluate(
    (data) => {
      return (window as any).encrypt(data.data1, data.data2)
    },
    {data1, data2},
  )

  return encrypt as string
}

const parseDoc = async (str: string): Promise<string> => {
  if (!isJSON(str)) return str

  const data = JSON.parse(str)

  const elements = []

  switch (data.name) {
    case 'doc': {
      if (!lodash.isEmpty(data.value)) {
        throwError('Not implemented yet', data)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      break
    }

    case 'p': {
      elements.push('<p>')

      if (!lodash.isEmpty(data.value)) {
        elements.push(data.value)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push('</p>')

      break
    }

    case 'color': {
      elements.push(`<span style="color: ${data.value}">`)

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push('</span>')

      break
    }

    case 'tex': {
      elements.push(`<img src="https://fb.fenbike.cn/api/planet/accessories/formulas?latex=${data.value}" />`)

      break
    }

    case 'txt': {
      elements.push(data.value)

      break
    }

    case 'br': {
      elements.push('<br />')

      break
    }

    case 'img': {
      elements.push(`<img src="https://fb.fenbike.cn/api/tarzan/images/${data.value}" />`)

      break
    }

    case 'u': {
      elements.push('<u>')

      if (!lodash.isEmpty(data.value)) {
        elements.push(data.value)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push('</u>')

      break
    }

    case 'input': {
      const _attrs = lodash
        .chain(data.value)
        .split(',')
        .map((dv) => {
          const _dv = dv.split(':')
          return `${_dv[0]}="${_dv[1]}"`
        })
        .join(' ')
        .value()

      elements.push(`<input ${_attrs} />`)

      break
    }

    case 'b': {
      elements.push('<b>')

      if (!lodash.isEmpty(data.value)) {
        elements.push(data.value)
      }

      if (!lodash.isEmpty(data.children)) {
        const children = await Promise.all(lodash.map(data.children, async (child) => parseDoc(JSON.stringify(child))))
        elements.push(...children)
      }

      elements.push('</b>')

      break
    }

    default: {
      throwError(`Not implemented yet of data name (${data.name})`, data)
    }
  }

  return elements.join('')
}

export default {PUBLIC_KEY, encrypt, parseDoc}
