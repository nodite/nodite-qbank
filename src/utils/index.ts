import cacheManager from '@type-cacheable/core'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import lodash from 'lodash'

export type FindOptions<T = object> = {
  excludeKey?: (keyof T)[]
  fuzzy?: boolean
}

export function find<T>(items: T[], substring: string, options?: FindOptions<T>): T | undefined {
  return lodash.find(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(find(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: never[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
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

export function findAll<T>(items: T[], substring: string, options?: FindOptions<T>): T[] {
  return lodash.filter(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(findAll(item, substring, options))
    }

    if (lodash.isObject(item) && !lodash.isArray(item)) {
      const subItems: never[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
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

export function throwError(message: string | unknown, data: unknown): never {
  fs.writeJsonSync('tmp/error.json', {data, message}, {spaces: 2})
  if (typeof message === 'string') throw new Error(message)
  throw message
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

export async function safeName(name: string): Promise<string> {
  if (name.length <= 48) return name

  const cacheClient = (cacheManager.default.client ?? cacheManager.default.fallbackClient) as cacheManager.CacheClient

  let _safeName = await cacheClient.get(`safe-name:${name}`)

  if (_safeName) return _safeName

  _safeName = name

  while (_safeName.length > 48) {
    const answers = await inquirer.prompt([
      {
        default: _safeName,
        message: `Safe name (max 48 chars):\n`,
        name: 'safeName',
        type: 'input',
      },
    ])
    _safeName = answers.safeName
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
