import path from 'node:path'

import ITExams from './itexams.js'

/**
 * https://www.itexams.com/vendor/Amazon
 */
export default class AwsITExams extends ITExams {
  public static META = {key: path.parse(import.meta.url).name, name: 'AWS'}

  protected get itxVendor(): string {
    return 'https://www.itexams.com/vendor/Amazon'
  }
}
