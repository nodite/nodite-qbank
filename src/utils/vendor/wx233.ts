import playwright from '../playwright.js'

const sid = async (): Promise<string> => {
  const page = await playwright.page('wx233', 'https://v.233.com/?do=notr')

  const _sid = await page.evaluate(() => {
    return (window as any)._japi.getSid('ucpage')
  })

  return _sid
}

const sign = async (httpData: any, sid: string, httpMethod: string): Promise<string> => {
  const page = await playwright.page('wx233', 'https://v.233.com/?do=notr')

  if (httpMethod.toLowerCase() !== 'get') httpData = JSON.stringify(httpData)

  const _sign = await page.evaluate(
    (data) => {
      return (window as any)._japi.getSign(data.httpData || {}, 'RZRRNN9RXYCP', data.sid, data.httpMethod.toLowerCase())
    },
    {httpData, httpMethod, sid},
  )

  return _sign
}

export default {sid, sign}
