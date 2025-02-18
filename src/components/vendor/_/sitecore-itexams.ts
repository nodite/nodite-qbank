import path from 'node:path'

import ITExams from './itexams.js'

export default class SitecoreITExams extends ITExams {
  public static META = {key: path.parse(import.meta.url).name, name: 'Sitecore'}

  protected get itxVendor(): string {
    return 'https://www.itexams.com/vendor/Sitecore'
  }
}
