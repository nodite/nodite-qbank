import colors from 'ansi-colors'
import lodash from 'lodash'

const info = (message?: any, ...optionalParams: any[]) => {
  if (lodash.isString(message)) {
    message = colors.green(message)
  }

  console.info(message, ...optionalParams)
}

const error = (message?: any, ...optionalParams: any[]) => {
  if (lodash.isString(message)) {
    message = colors.red(message)
  }

  console.error(message, ...optionalParams)
}

const warn = (message?: any, ...optionalParams: any[]) => {
  if (lodash.isString(message)) {
    message = colors.yellow(message)
  }

  console.warn(message, ...optionalParams)
}

export default {...console, error, info, warn}
