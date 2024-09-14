import puppeteer from '../puppeteer.js'

const sid = async (): Promise<string> => {
  const page = await puppeteer.page('wx233', 'https://v.233.com/?do=notr')

  const _sid = await page.evaluate(() => {
    return (window as any)._japi.getSid('ucpage')
  })

  return _sid
}

const sign = async (params: any, sid: string, type: string): Promise<string> => {
  const page = await puppeteer.page('wx233', 'https://v.233.com/?do=notr')

  if (type.toLowerCase() !== 'get') params = JSON.stringify(params)

  const _sign = await page.evaluate(
    (data) => {
      return (window as any)._japi.getSign(data.params || {}, 'RZRRNN9RXYCP', data.sid, data.type.toLowerCase())
    },
    {params, sid, type},
  )

  return _sign
}

export default {sid, sign}
