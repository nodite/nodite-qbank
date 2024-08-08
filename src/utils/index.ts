import lodash from 'lodash'

export type FindOptions<T = object> = {
  excludeKey?: (keyof T)[]
}

export function find<T>(items: T[], substring: unknown, options?: FindOptions<T>): T | undefined {
  return lodash.find(items, (item) => {
    if (lodash.isArray(item)) {
      return Boolean(find(item, substring))
    }

    if (lodash.isObject(item)) {
      const subItems = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return Boolean(find(subItems, substring))
    }

    return lodash.toString(item).includes(lodash.toString(substring))
  })
}

export function findAll<T>(items: T[], substring: unknown, options?: FindOptions<T>): T[] {
  return lodash.filter(items, (item) => {
    if (lodash.isArray(item)) {
      return !lodash.isEmpty(findAll(item, substring))
    }

    if (lodash.isObject(item)) {
      const subItems = Object.values(options?.excludeKey ? lodash.omit(item, options.excludeKey) : item)
      return !lodash.isEmpty(findAll(subItems, substring))
    }

    return lodash.toString(item).includes(lodash.toString(substring))
  })
}
