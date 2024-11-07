import fs from 'fs-extra'
import lodash from 'lodash'

const list = (): string[] => {
  return lodash
    .chain(fs.readdirSync(new URL('.', import.meta.url)))
    .map((file) => file.split('.')[0])
    .pull('index')
    .uniq()
    .value()
}

export default {list}
