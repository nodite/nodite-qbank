import fs from 'fs-extra'
import lodash from 'lodash'
import path from 'node:path'

const list = (): string[] => {
  return lodash
    .chain(fs.readdirSync(new URL('.', import.meta.url)))
    .map((file) => path.parse(file).name)
    .pull('index')
    .value()
}

export default {list}
