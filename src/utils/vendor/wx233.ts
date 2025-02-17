import puppeteer from '../puppeteer.js'

const sid = async (): Promise<string> => {
  const page = await puppeteer.page('wx233', 'https://v.233.com/?do=notr')

  await page.waitForFunction(
    () => {
      // eslint-disable-next-line no-undef
      return (window as any)._japi
    },
    {timeout: 0},
  )

  const _sid = await page.evaluate(() => {
    // eslint-disable-next-line no-undef
    return (window as any)._japi.getSid('ucpage')
  })

  return _sid
}

const sign = async (params: any, sid: string, type: string): Promise<string> => {
  const page = await puppeteer.page('wx233', 'https://v.233.com/?do=notr')

  // wait window._japi
  await page.waitForFunction(
    () => {
      // eslint-disable-next-line no-undef
      return (window as any)._japi
    },
    {timeout: 0},
  )

  if (type.toLowerCase() !== 'get') params = JSON.stringify(params)

  const _sign = await page.evaluate(
    (data) => {
      // eslint-disable-next-line no-undef
      return (window as any)._japi.getSign(data.params || {}, 'RZRRNN9RXYCP', data.sid, data.type.toLowerCase())
    },
    {params, sid, type},
  )

  return _sign
}

export default {sid, sign}
