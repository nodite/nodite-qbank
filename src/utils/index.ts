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
      return (
        // accurate
        Boolean(find(item, substring, {...options, fuzzy: false})) ||
        // fuzzy
        Boolean(find(item, substring, {...options, fuzzy: true}))
      )
    }

    if (lodash.isObject(item)) {
      const subItems: never[] = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return (
        // accurate
        Boolean(find(subItems, substring, {...options, fuzzy: false})) ||
        // fuzzy
        Boolean(find(subItems, substring, {...options, fuzzy: true}))
      )
    }

    if (lodash.isEmpty(substring)) return true

    return options?.fuzzy
      ? lodash.toString(item).includes(lodash.toString(substring))
      : lodash.isEqual(lodash.toString(item), lodash.toString(substring))
  })
}

export function fiind<T>(items: T[], substring: string, options?: FindOptions<T>): T | undefined {
  let item = find(items, substring, options)
  if (!item) item = find(items, substring, {...options, fuzzy: true})
  return item
}

export function findAll<T>(items: T[], substring: string | string[], options?: FindOptions<T>): T[] {
  const _strs = lodash.filter(lodash.isArray(substring) ? substring : [substring])
  return lodash
    .chain(_strs)
    .map((str) => fiind(items, str, options))
    .filter()
    .value() as T[]
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
        message: `Safe name (max 48 chars) [default: ${_safeName}]:`,
        name: 'safeName',
        type: 'input',
      },
    ])
    _safeName = answers.safeName
  }

  await cacheClient.set(`safe-name:${name}`, _safeName)

  return _safeName
}
