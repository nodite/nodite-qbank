import path from 'node:path'

import {input} from '@inquirer/prompts'
import fs from 'fs-extra'
import lodash from 'lodash'

import {ParseOptions, SafeNameOptions} from '../@types/common.js'
import cacheManager from '../cache/cache.manager.js'
import axios from '../components/axios/index.js'
import {Vendor} from '../components/vendor/common.js'
import {TMP_DIR} from '../env.js'
import console from './console.js'

export type FindOptions<T = object> = {
  excludeKey?: ('meta' | keyof T)[]
  fuzzy?: boolean
}

export function find<T>(items: T[], substring: string, options: FindOptions<T> = {}): T | undefined {
  options.excludeKey = [...(options.excludeKey ?? []), 'meta']

  return lodash.find(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(find(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: any[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return !lodash.isEmpty(find(subItems, substring, options))
    }

    if (lodash.isEmpty(substring)) return true

    return options?.fuzzy
      ? lodash.toString(item).includes(lodash.toString(substring))
      : lodash.isEqual(lodash.toString(item), lodash.toString(substring))
  })
}

export function fiind<T>(items: T[], substring: string, options?: FindOptions<T>): T | undefined {
  let item = find(items, substring, {...options, fuzzy: false})
  if (!item) item = find(items, substring, {...options, fuzzy: true})
  return item
}

export function findAll<T>(items: T[], substring: string, options: FindOptions<T> = {}): T[] {
  options.excludeKey = [...(options.excludeKey ?? []), 'meta']

  return lodash.filter(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(findAll(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: any[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return !lodash.isEmpty(findAll(subItems, substring, options))
    }

    if (lodash.isEmpty(substring)) return true

    return options?.fuzzy
      ? lodash.toString(item).includes(lodash.toString(substring))
      : lodash.isEqual(lodash.toString(item), lodash.toString(substring))
  })
}

export function fiindAll<T>(items: T[], substrings: string[], options?: FindOptions<T>): T[] {
  if (lodash.isEmpty(substrings)) return items

  return lodash
    .chain(substrings)
    .map((substring) => {
      let results = findAll(items, substring, {...options, fuzzy: false})
      if (lodash.isEmpty(results)) results = findAll(items, substring, {...options, fuzzy: true})
      return results
    })
    .flattenDeep()
    .value()
}

export function throwError(message: any | string, data: any): never {
  let errFile = path.join(TMP_DIR, 'error.json')

  if (lodash.has(data, 'qbank')) {
    const qbank = data.qbank as Record<string, any>
    const vendor = qbank.vendor as Vendor
    errFile = `tmp/error-${(vendor.constructor as typeof Vendor).META.key}.json`
  }

  fs.writeJsonSync(errFile, {data, message}, {spaces: 2})

  if (lodash.isString(message)) throw new Error(message)

  // is error
  if (message instanceof Error) throw message

  // otherwise
  throw new Error(JSON.stringify(message))
}

export function reverseTemplate(template: string, result: string): Record<string, any> {
  const templateParts = template.split(':')
  const resultParts = result.split(':')

  const obj = {} as Record<string, any>

  for (const [index, part] of templateParts.entries()) {
    const match = /{{(.*?)}}/.exec(part)
    if (!match) continue
    obj[match[1].trim()] = resultParts[index] || null
  }

  return obj
}

/**
 * Safe name.
 */
export async function safeName(name: string, options: SafeNameOptions = {}): Promise<string> {
  name = lodash.trim(name)

  if (!options?.length) options.length = 48

  const cacheClient = cacheManager.CommonClient

  let _safeName = await cacheClient.get<string>(`safe-name:${name}`)

  if (_safeName && _safeName.length <= options.length) return _safeName

  if (name.length <= options.length) return name

  _safeName = name

  while (_safeName.length > options.length) {
    _safeName = await input({
      default: _safeName,
      message: `Safe name (max ${options.length} chars):\n`,
    })
  }

  await cacheClient.set(`safe-name:${name}`, _safeName)

  return _safeName
}

export function isJSON(str: string): boolean {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

export function isUrl(str: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new URL(str)
    return true
  } catch {
    return false
  }
}

export function getMemoryUsage(): Record<string, string> {
  const memoryUsage = process.memoryUsage()
  return lodash.mapValues(memoryUsage, (value) => (value / 1024 / 1024).toFixed(2) + ' MB')
}

export async function handleImageSrc(src: string, srcHandler: ParseOptions['srcHandler']): Promise<string> {
  if (!srcHandler || !src) return src

  let srcs = srcHandler(src)
  if (!lodash.isArray(srcs)) srcs = [srcs]

  let _src =
    srcs.length === 1
      ? srcs.pop()
      : lodash.find(
          await Promise.all(
            lodash.map(srcs, async (src) =>
              axios
                .get(src, {responseType: 'arraybuffer'})
                .then(() => src)
                .catch(() => {
                  console.warn(`image not found: ${src}`)
                  return false
                }),
            ),
          ),
          (src) => src,
        )

  if (!_src) {
    await fs.ensureFile(path.join(TMP_DIR, 'srcs-missing.log'))
    await fs.appendFile(path.join(TMP_DIR, 'srcs-missing.log'), `${srcs.join('\n')}\n\n`)
    _src = srcs.shift()
  }

  return _src as string
}
