import * as playwright from 'playwright'

export const PUBLIC_KEY =
  'ANKi9PWuvDOsagwIVvrPx77mXNV0APmjySsYjB1' +
  '/GtUTY6cyKNRl2RCTt608m9nYk5VeCG2EAZRQmQ' +
  'NQTyfZkw0Uo+MytAkjj17BXOpY4o6+BToi7rRKf' +
  'TGl6J60/XBZcGSzN1XVZ80ElSjaGE8Ocg8wbPN18tbmsy761zN5SuIl'

const encrypt = async (data1: any | null, data2: any | null): Promise<null | string> => {
  const browser = await playwright.webkit.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('https://www.fenbi.com')
  const encrypt = await page.evaluate(
    (data) => {
      return (window as any).encrypt(data.data1, data.data2)
    },
    {data1, data2},
  )
  await browser.close()
  return encrypt as string
}

export default {PUBLIC_KEY, encrypt}
