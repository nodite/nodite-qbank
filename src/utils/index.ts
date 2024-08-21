import fs from 'fs-extra'
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

export function findAll<T>(items: T[], substring: string | string[], options?: FindOptions<T>): T[] {
  return lodash.filter(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(findAll(item, substring, options))
    }

    if (lodash.isObject(item)) {
      const subItems = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item) as any[]
      return !lodash.isEmpty(findAll(subItems, substring, options))
    }

    const _strs = lodash.filter(lodash.isArray(substring) ? substring : [substring])

    if (lodash.isEmpty(_strs)) return true

    return lodash.some(_strs, (str) =>
      options?.fuzzy
        ? lodash.toString(item).includes(lodash.toString(str))
        : lodash.isEqual(lodash.toString(item), lodash.toString(str)),
    )
  })
}

export function throwError(message: string, data: unknown): never {
  fs.writeJsonSync('tmp/error.json', {data, message}, {spaces: 2})
  throw new Error(message)
}
